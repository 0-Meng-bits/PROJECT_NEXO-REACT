import { supabaseAdmin } from './_supabase.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, fullName, studentId, user_type, id_verified, id_photo_base64, id_photo_ext } = req.body;

  // Create user with email_confirm: false (requires verification)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // User must verify email
  });

  if (authError) return res.status(400).json({ message: authError.message });
  if (!authData.user) return res.status(400).json({ message: 'Signup failed.' });

  // Upload ID photo via service role if provided
  let idPhotoUrl = null;
  if (id_photo_base64) {
    try {
      const ext = id_photo_ext || 'jpg';
      const path = `id-photos/${studentId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`;
      const buffer = Buffer.from(id_photo_base64, 'base64');
      const { error: uploadError } = await supabaseAdmin.storage
        .from('id-photos')
        .upload(path, buffer, { contentType: `image/${ext}`, upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage.from('id-photos').getPublicUrl(path);
        idPhotoUrl = urlData.publicUrl;
      }
    } catch {
      // photo upload failure is non-fatal
    }
  }

  // Insert profile linked to auth user
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert([{
      id: authData.user.id,
      student_id: studentId,
      full_name: fullName,
      email,
      user_type,
      is_verified: false,
      id_verified: id_verified || false,
      id_photo_url: idPhotoUrl,
    }])
    .select().single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ message: error.message });
  }

  // Generate email verification link
  const siteUrl = process.env.SITE_URL || 'https://project-nexo-react.vercel.app';
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email: email,
    options: { redirectTo: `${siteUrl}/portal` },
  });

  if (linkError) {
    console.error('[SIGNUP] Link generation error:', linkError.message);
    // Continue anyway - user can request password reset to verify email later
  }

  // Send verification email via Gmail SMTP
  if (linkData?.properties?.action_link) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    try {
      await transporter.sendMail({
        from: `"NEXO Connect" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Verify your NEXO Connect account',
        html: `
          <div style="font-family:monospace;background:#0d0d12;color:white;padding:32px;border-radius:8px;">
            <h2 style="color:#00f0ff;letter-spacing:2px;">NEXO CONNECT</h2>
            <p>Welcome, <strong>${fullName}</strong>!</p>
            <p>Click the link below to verify your email and activate your account:</p>
            <a href="${linkData.properties.action_link}"
               style="display:inline-block;margin:16px 0;padding:12px 24px;background:#f5e642;color:#0d0d12;font-weight:bold;text-decoration:none;border-radius:4px;">
              VERIFY EMAIL
            </a>
            <p style="color:#666;font-size:12px;">This link expires in 24 hours. After verification, your account will be reviewed by an admin.</p>
          </div>
        `,
      });
      console.log('[SIGNUP] Verification email sent to', email);
    } catch (emailErr) {
      console.error('[SIGNUP] Email send error:', emailErr.message);
      // Non-fatal - user can request password reset to verify later
    }
  }

  res.status(200).json({
    message: 'Account created! Check your email to verify your account.',
    user: data,
    session: null,
  });
}
