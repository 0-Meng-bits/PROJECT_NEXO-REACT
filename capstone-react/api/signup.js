import crypto from 'crypto';
import { supabaseAdmin } from './_supabase.js';
import nodemailer from 'nodemailer';

function getOtpSecret() {
  const secret = process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing OTP secret configuration.');
  return secret;
}

function signPayload(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getOtpSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedPayload(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', getOtpSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function hashOtpCode(email, studentId, code) {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${String(email).trim().toLowerCase()}:${String(studentId).trim()}:${String(code).trim()}`)
    .digest('hex');
}

async function sendEmail({ to, subject, html }) {
  let emailSent = false;
  let lastError = 'Email service not configured.';

  // Try Resend first (reliable on cloud)
  if (process.env.RESEND_API_KEY) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'NEXO Connect <onboarding@resend.dev>', to, subject, html }),
      });
      if (resendRes.ok) {
        emailSent = true;
      } else {
        const errBody = await resendRes.json().catch(() => ({}));
        lastError = errBody.message || `Resend HTTP ${resendRes.status}`;
        console.error('[SIGNUP] Resend error:', lastError);
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  // Fall back to Gmail with 10s timeout
  if (!emailSent && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
      await transporter.sendMail({
        from: `"NEXO Connect" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      emailSent = true;
      console.log('[SIGNUP] Email sent to', to);
    } catch (emailErr) {
      lastError = emailErr.message;
      console.error('[SIGNUP] Email send error:', emailErr.message);
    }
  }

  return { ok: emailSent, error: lastError };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action } = req.body || {};

  // ── STEP 1A: SEND 6-DIGIT EMAIL OTP BEFORE ID/SELFIE ────────────────────
  if (action === 'send-otp') {
    const { email, studentId, fullName } = req.body;
    if (!email || !studentId) {
      return res.status(400).json({ message: 'Email and CTU ID are required.' });
    }

    const { data: existingAccount } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('ctu_id', studentId)
      .maybeSingle();
    if (existingAccount) {
      return res.status(400).json({ message: 'This CTU ID is already registered.' });
    }

    const { data: existingEmailAcc } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existingEmailAcc) {
      return res.status(400).json({ message: 'This email is already registered.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const otpToken = signPayload({
      type: 'email_otp',
      email: email.trim().toLowerCase(),
      studentId: String(studentId).trim(),
      codeHash: hashOtpCode(email, studentId, code),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    const emailHtml = `
      <div style="font-family:monospace;background:#0d0d12;color:white;padding:32px;border-radius:8px;">
        <h2 style="color:#00f0ff;letter-spacing:2px;">NEXO CONNECT</h2>
        <p>Welcome, <strong>${fullName || 'Student'}</strong>!</p>
        <p>Enter this 6-digit verification code to continue your registration:</p>
        <div style="margin:20px 0;padding:16px 24px;background:#16161f;border:1px solid #00f0ff;border-radius:8px;text-align:center;font-size:32px;font-weight:800;letter-spacing:10px;color:#f5e642;">
          ${code}
        </div>
        <p style="color:#888;font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    const { ok: sent, error: sendErr } = await sendEmail({
      to: email.trim(),
      subject: `${code} is your NEXO Connect verification code`,
      html: emailHtml,
    });

    if (!sent) {
      return res.status(500).json({ message: `Failed to send verification code: ${sendErr}` });
    }

    return res.json({ ok: true, otpToken });
  }

  // ── STEP 1B: VERIFY 6-DIGIT EMAIL OTP ────────────────────────────────────
  if (action === 'verify-otp') {
    const { email, studentId, code, otpToken } = req.body;
    const payload = verifySignedPayload(otpToken);
    if (!payload || payload.type !== 'email_otp') {
      return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
    }
    if (
      payload.email !== String(email || '').trim().toLowerCase() ||
      payload.studentId !== String(studentId || '').trim()
    ) {
      return res.status(400).json({ message: 'Email or CTU ID mismatch. Please go back and try again.' });
    }

    const candidateHash = hashOtpCode(email, studentId, code || '');
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(payload.codeHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }

    const emailVerifiedToken = signPayload({
      type: 'email_verified',
      email: payload.email,
      studentId: payload.studentId,
      exp: Date.now() + 30 * 60 * 1000, // 30 minutes to complete ID + selfie
    });

    return res.json({ ok: true, emailVerifiedToken });
  }

  const { email, password, fullName, studentId, user_type, gender, id_verified, id_photo_base64, id_photo_ext, selfie_base64, selfie_ext, emailVerifiedToken } = req.body;

  // Enforce email OTP verification token before creating account
  const verifiedPayload = verifySignedPayload(emailVerifiedToken);
  if (
    !verifiedPayload ||
    verifiedPayload.type !== 'email_verified' ||
    verifiedPayload.email !== String(email || '').trim().toLowerCase() ||
    verifiedPayload.studentId !== String(studentId || '').trim()
  ) {
    return res.status(403).json({ message: 'Email verification required before creating an account.' });
  }

  // Validate gender
  const VALID_GENDERS = ['Male', 'Female', 'Prefer not to say'];
  if (!VALID_GENDERS.includes(gender)) {
    return res.status(400).json({ message: 'Invalid gender value.' });
  }

  // Check for duplicate CTU ID or active email before creating auth user
  const { data: existingAccount } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('ctu_id', studentId)
    .maybeSingle();
  if (existingAccount) {
    return res.status(400).json({ message: 'This CTU ID is already registered.' });
  }

  const { data: existingEmailAcc } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existingEmailAcc) {
    return res.status(400).json({ message: 'This email is already registered.' });
  }

  // Create user with email already confirmed via 6-digit OTP
  let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // If Auth says email exists even though accounts has no row, clean up the orphaned auth user and retry
  if (authError && /already|exists/i.test(authError.message || '')) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const orphan = (listData?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (orphan) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(orphan.id);
      if (delErr) {
        await supabaseAdmin.auth.admin.updateUserById(orphan.id, { email: `deleted_${orphan.id}@deleted.local` }).catch(() => {});
      }
      const retry = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      authData = retry.data;
      authError = retry.error;
    }
  }

  if (authError) return res.status(400).json({ message: authError.message });
  if (!authData?.user) return res.status(400).json({ message: 'Signup failed.' });

  // Upload ID photo and live selfie via service role if provided
  const uploadVerificationImage = async (base64, ext, folder) => {
    if (!base64) return null;
    try {
      const safeExt = ext || 'jpg';
      const path = `${folder}/${studentId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${safeExt}`;
      const buffer = Buffer.from(base64, 'base64');
      const { error: uploadError } = await supabaseAdmin.storage
        .from('id-photos')
        .upload(path, buffer, { contentType: `image/${safeExt}`, upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage.from('id-photos').getPublicUrl(path);
        return urlData.publicUrl;
      }
    } catch {
      // photo upload failure is non-fatal
    }
    return null;
  };

  const [idPhotoUrl, selfieUrl] = await Promise.all([
    uploadVerificationImage(id_photo_base64, id_photo_ext, 'id-photos'),
    uploadVerificationImage(selfie_base64, selfie_ext, 'selfie-photos'),
  ]);

  try {
    await supabaseAdmin.from('accounts').insert([{
      id: authData.user.id, ctu_id: studentId, full_name: fullName, email, user_type,
    }]);
    await supabaseAdmin.from('account_status').insert([{ id: authData.user.id, is_verified: false }]);
    await supabaseAdmin.from('account_details').insert([{ id: authData.user.id, id_photo_url: idPhotoUrl, selfie_url: selfieUrl, gender }]);
  } catch (e) {
    console.warn('[SIGNUP] New table insert warning:', e.message);
  }

  res.status(200).json({
    message: 'Account created! Your account is now pending admin approval.',
    user: { id: authData.user.id, ctu_id: studentId, full_name: fullName, email, user_type },
    session: null,
  });
}
