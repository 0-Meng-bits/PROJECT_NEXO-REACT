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

// ── AUTO-MIGRATE: ensure cover_url column exists ──────────────────────────────
(async () => {
  try {
    const { error } = await supabaseAdmin
      .from('communities')
      .update({ cover_url: null })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    if (error && (error.message.includes('cover_url') || error.code === '42703')) {
      console.warn('⚠️  [STARTUP] cover_url column missing from communities table.');
      console.warn('   Run this SQL in Supabase Dashboard → SQL Editor:');
      console.warn('   ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;');
    } else {
      console.log('✅ [STARTUP] communities.cover_url column OK');
    }
  } catch (e) {
    // ignore
  }
})();

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
    
    // Check if it's an email verification error
    if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email')) {
      return res.status(401).json({ message: 'Please verify your email first. Check your inbox for the verification link.' });
    }
    
    // Legacy account — Supabase Auth user doesn't exist yet
    // If password column is null (cleared), we can't validate — check against provided password only if stored
    const passwordOk = !profile.password || profile.password === password;

    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    return res.json({
      message: isPending ? 'Pending approval' : 'Authentication successful',
      user: profile,
      session: null,
      pending: isPending,
      legacy: true,
    });
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
  const { email, password, fullName, studentId, user_type } = req.body;

  // 1. Create Supabase Auth user with email_confirm: false (requires verification)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // User must verify email
  });

  if (authError) {
    console.error('[SIGNUP] createUser error:', authError.message, authError.status);
    return res.status(400).json({ message: authError.message });
  }

  // 2. Insert profile linked to auth user
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert([{
      id: authData.user.id,
      student_id: studentId,
      full_name: fullName,
      email,
      user_type,
      is_verified: false,
    }])
    .select().single();

  if (error) {
    // Rollback auth user if profile insert fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    // Give a friendly message for common constraint violations
    if (error.code === '23505' || error.message.includes('profiles_student_id_key')) {
      return res.status(400).json({ message: 'This CTU ID is already registered. Try logging in instead.' });
    }
    if (error.message.includes('profiles_email_key') || error.message.includes('email')) {
      return res.status(400).json({ message: 'This email is already in use. Try logging in instead.' });
    }
    return res.status(400).json({ message: error.message });
  }

  // 3. Generate email verification link
  const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email: email,
    options: { redirectTo: `${siteUrl}/portal` },
  });

  if (linkError) {
    console.error('[SIGNUP] Link generation error:', linkError.message);
  }

  // 4. Send verification email via Gmail SMTP (if configured)
  if (linkData?.properties?.action_link && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
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
    }
  }

  res.status(200).json({ 
    message: 'Account created! Check your email to verify your account.', 
    user: data, 
    session: null 
  });
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

// ── DELETE USER (admin only) ──────────────────────────────────────────────────
app.delete('/api/delete-user/:id', async (req, res) => {
  // Verify the requester is an admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ message: 'Invalid session.' });

  const { data: adminProfile } = await supabaseAdmin
    .from('profiles').select('user_type').eq('id', user.id).single();
  if (!adminProfile || adminProfile.user_type !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  const targetId = req.params.id;
  if (!targetId) return res.status(400).json({ message: 'User ID required.' });

  // Delete profile first (cascades related data via FK)
  const { error: profileError } = await supabaseAdmin
    .from('profiles').delete().eq('id', targetId);
  if (profileError) {
    console.error('[DELETE USER] Profile delete error:', profileError.message);
    return res.status(500).json({ message: 'Failed to delete profile.', detail: profileError.message });
  }

  // Delete from Supabase Auth
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (authDeleteError) {
    console.error('[DELETE USER] Auth delete error:', authDeleteError.message);
    // Profile already deleted — still return success but warn
    return res.status(207).json({ message: 'Profile deleted but auth user removal failed.', detail: authDeleteError.message });
  }

  console.log('[DELETE USER] Deleted user', targetId);
  res.json({ message: 'User deleted successfully.' });
});

// ── DELETE COMMUNITY ─────────────────────────────────────────────────────────
app.delete('/api/delete-community', async (req, res) => {
  const { id, userId } = req.query;
  if (!id) return res.status(400).json({ message: 'Community ID is required.' });

  let resolvedUserId = null;

  // Try JWT auth first (normal Supabase Auth accounts)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) resolvedUserId = user.id;
  }

  // Fallback for legacy accounts — verify the userId exists in profiles
  if (!resolvedUserId && userId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('id').eq('id', userId).single();
    if (profile) resolvedUserId = profile.id;
  }

  if (!resolvedUserId) {
    return res.status(401).json({ message: 'Unable to verify identity.' });
  }

  // Confirm the requester is the creator
  const { data: community, error: fetchError } = await supabaseAdmin
    .from('communities').select('id, creator_id').eq('id', id).single();

  if (fetchError || !community) return res.status(404).json({ message: 'Circle not found.' });

  if (community.creator_id !== resolvedUserId) {
    return res.status(403).json({ message: 'Only the circle creator can delete it.' });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('communities').delete().eq('id', id);

  if (deleteError) return res.status(400).json({ message: deleteError.message });

  res.json({ message: 'Circle deleted successfully.' });
});

// ── UPLOAD CIRCLE COVER PHOTO ────────────────────────────────────────────────
app.post('/api/upload-cover', async (req, res) => {
  let resolvedUserId = null;

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) resolvedUserId = user.id;
  }
  if (!resolvedUserId) {
    const legacyUserId = req.headers['x-user-id'];
    if (legacyUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('id').eq('id', legacyUserId).single();
      if (profile) resolvedUserId = profile.id;
    }
  }
  if (!resolvedUserId) {
    console.error('[UPLOAD COVER] Could not resolve user identity');
    return res.status(401).json({ message: 'Unable to verify identity.' });
  }

  const { cover, communityId } = req.body;
  if (!cover || !communityId) return res.status(400).json({ message: 'Missing cover or communityId.' });

  // Ensure cover_url column exists (auto-migrate if needed)
  try {
    await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;'
    });
  } catch (_) {
    // rpc may not exist — try raw query via pg extension, ignore if fails
  }

  // Confirm requester is the creator
  const { data: comm, error: commErr } = await supabaseAdmin
    .from('communities').select('creator_id').eq('id', communityId).single();
  if (commErr) {
    console.error('[UPLOAD COVER] Could not fetch community:', commErr.message);
    return res.status(500).json({ message: 'Could not verify community.' });
  }
  if (!comm || comm.creator_id !== resolvedUserId) {
    return res.status(403).json({ message: 'Only the circle creator can change the cover photo.' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('communities')
    .update({ cover_url: cover })
    .eq('id', communityId);

  if (updateError) {
    console.error('[UPLOAD COVER] DB update error:', updateError.message);
    // If column doesn't exist, tell the client clearly
    if (updateError.message.includes('cover_url') || updateError.message.includes('column')) {
      return res.status(500).json({ message: 'cover_url column missing. Run migration first.', detail: updateError.message });
    }
    return res.status(500).json({ message: 'Failed to save cover photo.', detail: updateError.message });
  }

  console.log('[UPLOAD COVER] Saved cover for community', communityId);
  res.json({ url: cover });
});

// ── UPLOAD ID PHOTO (for verification) ───────────────────────────────────────
app.post('/api/upload-id-photo', async (req, res) => {
  let resolvedUserId = null;

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) resolvedUserId = user.id;
  }
  if (!resolvedUserId) {
    const legacyUserId = req.headers['x-user-id'];
    if (legacyUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('id').eq('id', legacyUserId).single();
      if (profile) resolvedUserId = profile.id;
    }
  }
  if (!resolvedUserId) return res.status(401).json({ message: 'Unable to verify identity.' });

  const { photo } = req.body;
  if (!photo) return res.status(400).json({ message: 'No photo provided.' });

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ id_photo_url: photo })
    .eq('id', resolvedUserId);

  if (error) {
    console.error('[UPLOAD ID PHOTO] DB error:', error.message);
    return res.status(500).json({ message: 'Failed to save ID photo.' });
  }

  console.log('[UPLOAD ID PHOTO] Saved for user', resolvedUserId);
  res.json({ message: 'ID photo uploaded successfully.' });
});

// ── UPLOAD AVATAR ─────────────────────────────────────────────────────────────
app.post('/api/upload-avatar', async (req, res) => {
  let resolvedUserId = null;

  // Try JWT auth first
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) resolvedUserId = user.id;
  }

  // Fallback for legacy accounts (no JWT) — verify userId exists in profiles
  if (!resolvedUserId) {
    const legacyUserId = req.headers['x-user-id'];
    if (legacyUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('id').eq('id', legacyUserId).single();
      if (profile) resolvedUserId = profile.id;
    }
  }

  if (!resolvedUserId) {
    return res.status(401).json({ message: 'Unable to verify identity.' });
  }

  const { avatar } = req.body; // base64 data URL string
  if (!avatar) return res.status(400).json({ message: 'No avatar data provided.' });

  // Save base64 directly to the avatar_url column — no storage bucket needed
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: avatar })
    .eq('id', resolvedUserId);

  if (updateError) {
    console.error('[UPLOAD AVATAR] Profile update error:', updateError.message);
    return res.status(500).json({ message: 'Failed to save avatar.' });
  }

  res.json({ url: avatar });
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'CTU ID is required.' });

  const { data: profile, error } = await supabaseAdmin
    .from('profiles').select('email').eq('student_id', studentId).single();

  if (error || !profile) return res.status(404).json({ message: 'CTU ID not found.' });

  const siteUrl = process.env.SITE_URL || 'http://localhost:5173';

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo: `${siteUrl}/reset-password` },
  });

  if (linkError) {
    console.error('[FORGOT PASSWORD] Link error:', linkError.message);
    return res.status(400).json({ message: linkError.message });
  }

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
    console.log('[FORGOT PASSWORD] Reset email sent to', profile.email);
  } catch (emailErr) {
    console.error('[FORGOT PASSWORD] Email send error:', emailErr.message);
    return res.status(400).json({ message: 'Failed to send reset email.' });
  }

  res.status(200).json({ message: 'Password reset email sent.' });
});

// ── SELF: DEACTIVATE ACCOUNT ──────────────────────────────────────────────────
app.post('/api/deactivate-account', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'User ID required.' });

  // Verify the requester is the account owner
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && token !== 'null' && token !== 'undefined') {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: 'Invalid session.' });
    if (user.id !== userId) return res.status(403).json({ message: 'You can only deactivate your own account.' });
  }

  // Mark as deactivated — set is_verified to false and add a deactivated flag
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_verified: false, deactivated: true })
    .eq('id', userId);

  if (error) {
    // If deactivated column doesn't exist, just set is_verified false
    const { error: e2 } = await supabaseAdmin
      .from('profiles')
      .update({ is_verified: false })
      .eq('id', userId);
    if (e2) return res.status(500).json({ message: 'Failed to deactivate account.' });
  }

  // Disable the auth user so they can't log in
  await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876600h' }); // ~100 years

  console.log('[DEACTIVATE] User deactivated:', userId);
  res.json({ message: 'Account deactivated successfully.' });
});

// ── SELF: DELETE ACCOUNT ──────────────────────────────────────────────────────
app.delete('/api/delete-account', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'User ID required.' });

  // Verify the requester is the account owner
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && token !== 'null' && token !== 'undefined') {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: 'Invalid session.' });
    if (user.id !== userId) return res.status(403).json({ message: 'You can only delete your own account.' });
  }

  // Delete profile (cascades memberships, notifications, etc.)
  const { error: profileError } = await supabaseAdmin
    .from('profiles').delete().eq('id', userId);
  if (profileError) {
    console.error('[DELETE ACCOUNT] Profile error:', profileError.message);
    return res.status(500).json({ message: 'Failed to delete profile.' });
  }

  // Delete from Supabase Auth
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) {
    console.error('[DELETE ACCOUNT] Auth error:', authError.message);
    return res.status(207).json({ message: 'Profile deleted but auth removal failed.' });
  }

  console.log('[DELETE ACCOUNT] User permanently deleted:', userId);
  res.json({ message: 'Account permanently deleted.' });
});

// ── ADMIN: VERIFY STUDENT ─────────────────────────────────────────────────────
app.post('/api/verify-student/:id', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('profiles').update({ is_verified: true }).eq('id', req.params.id);
  if (error) return res.status(400).json(error);
  res.json({ message: 'Student verified!' });
});

// ── ADMIN: FORCE VERIFY EMAIL ─────────────────────────────────────────────────
app.post('/api/force-verify-email/:id', async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
    email_confirm: true,
  });
  if (error) return res.status(400).json({ message: error.message });
  res.json({ message: 'Email confirmed.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ CTU Connect server running at http://localhost:${port}`);
});
