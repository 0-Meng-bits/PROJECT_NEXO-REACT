require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3000;

// Use service role for admin operations (verify, reject)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Anon client for auth operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.use(express.json({ limit: '10mb' }));

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ message: 'Invalid or expired session.' });

  req.authUser = user;
  next();
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    const { data } = await supabaseAdmin
      .from('profiles').select('user_type').eq('id', req.authUser.id).single();
    if (data?.user_type !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
  });
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { studentId, password } = req.body;

  // 1. Find profile by student_id to get their email
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('*').eq('student_id', studentId).single();

  if (profileError || !profile) {
    return res.status(401).json({ message: 'CTU_ID not found in the system.' });
  }

  // 2. Check verification — but still allow login with limited access
  const isPending = !profile.is_verified;

  // 3. Sign in via Supabase Auth (issues real JWT)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (authError) {
    console.error('[LOGIN] signInWithPassword error:', authError.message, authError.status);

    // Auto-confirm email and retry — this is a school system, email confirmation
    // is not required since admin verifies identity via ID photo instead
    if (authError.message?.includes('Email not confirmed')) {
      try {
        // Force-confirm the email using admin client
        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          email_confirm: true,
        });
        // Retry sign in
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password,
        });
        if (retryError) {
          return res.status(401).json({ message: 'Invalid credentials.' });
        }
        return res.json({
          message: isPending ? 'Pending approval' : 'Authentication successful',
          user: profile,
          session: retryData.session,
          pending: isPending,
        });
      } catch (confirmErr) {
        console.error('[LOGIN] Auto-confirm error:', confirmErr.message);
        return res.status(401).json({ message: 'Login failed. Please contact admin.' });
      }
    }

    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  res.json({
    message: isPending ? 'Pending approval' : 'Authentication successful',
    user: profile,
    session: authData.session,
    pending: isPending,
  });
});

// ── SIGNUP ────────────────────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { email, password, fullName, studentId, user_type, id_photo_base64, id_photo_ext } = req.body;

  if (!email || !password || !fullName || !studentId || !user_type) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // Create user with email auto-confirmed (to avoid rate limits in development)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error('[SIGNUP] signUp error:', authError.message);
    return res.status(400).json({ message: authError.message });
  }

  if (!authData.user) {
    return res.status(400).json({ message: 'Signup failed.' });
  }

  // Upload ID photo if provided
  let id_photo_url = null;
  if (id_photo_base64 && id_photo_ext) {
    try {
      const buffer = Buffer.from(id_photo_base64, 'base64');
      const path = `id-photos/${studentId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${id_photo_ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('id-photos')
        .upload(path, buffer, { contentType: `image/${id_photo_ext}`, upsert: true });
      
      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage.from('id-photos').getPublicUrl(path);
        id_photo_url = urlData.publicUrl;
      } else {
        console.error('[SIGNUP] Photo upload error:', uploadError.message);
      }
    } catch (err) {
      console.error('[SIGNUP] Photo processing error:', err.message);
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
      id_photo_url,
    }])
    .select().single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    console.error('[SIGNUP] Profile insert error:', error.message);
    return res.status(400).json({ message: error.message });
  }

  res.status(200).json({ message: 'Check your email to confirm your account.', user: data, session: null });
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'CTU ID is required.' });

  const { data: profile, error } = await supabaseAdmin
    .from('profiles').select('email').eq('student_id', studentId).single();

  if (error || !profile) return res.status(404).json({ message: 'CTU ID not found.' });

  // Generate password reset link via Supabase Admin
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: {
      redirectTo: process.env.SITE_URL
        ? `${process.env.SITE_URL}/reset-password`
        : 'http://localhost:5173/reset-password',
    },
  });

  if (linkError) {
    console.error('[FORGOT PASSWORD] Link generation error:', linkError.message);
    return res.status(400).json({ message: linkError.message });
  }

  console.log('[FORGOT PASSWORD] Generated link:', linkData.properties.action_link);

  // Send email via Gmail SMTP
  const nodemailer = require('nodemailer');
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
      to: profile.email,
      subject: 'Reset your NEXO Connect password',
      html: `
        <div style="font-family:monospace;background:#0d0d12;color:white;padding:32px;border-radius:8px;">
          <h2 style="color:#00f0ff;letter-spacing:2px;">NEXO CONNECT</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <a href="${linkData.properties.action_link}"
             style="display:inline-block;margin:16px 0;padding:12px 24px;background:#f5e642;color:#0d0d12;font-weight:bold;text-decoration:none;border-radius:4px;">
            RESET PASSWORD
          </a>
          <p style="color:#666;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('[FORGOT PASSWORD] Email send error:', emailErr.message);
    return res.status(400).json({ message: 'Failed to send reset email.' });
  }

  res.json({ message: 'Password reset email sent.' });
});

// ── SESSION VERIFY (frontend calls this to validate stored session) ────────────
app.get('/api/me', requireAuth, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('profiles').select('*').eq('id', req.authUser.id).single();
  if (!data) return res.status(404).json({ message: 'Profile not found.' });
  res.json({ user: data });
});

// ── ADMIN: GET ALL STUDENTS ───────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  // Try token auth first, fall back to allowing if no token (legacy admin)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: 'Invalid session.' });
    const { data: profile } = await supabaseAdmin.from('profiles').select('user_type').eq('id', user.id).single();
    if (profile?.user_type !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
  }
  // Legacy: no token but called from admin dashboard — allow
  const { data, error } = await supabaseAdmin
    .from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json(error);
  res.json(data);
});

// ── ADMIN: VERIFY STUDENT ─────────────────────────────────────────────────────
app.post('/api/verify-student/:id', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('profiles').update({ is_verified: true }).eq('id', req.params.id);
  if (error) return res.status(400).json(error);
  res.json({ message: 'Student verified!' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ CTU Connect server running at http://localhost:${port}`);
});
