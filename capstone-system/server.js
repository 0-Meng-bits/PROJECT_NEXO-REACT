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

app.use(express.json());

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

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
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
    return res.status(400).json({ message: error.message });
  }

  // Sign them in to get a session token
  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });

  res.status(200).json({ message: 'Awaiting approval', user: data, session: sessionData?.session || null });
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
