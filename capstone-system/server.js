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

  // Check if permanently banned
  if (profile.is_banned) {
    return res.status(403).json({
      message: 'Your account has been permanently banned due to serious violations. Contact the administrator if you believe this is a mistake.',
      banned: true,
    });
  }

  // Check if suspended
  if (profile.suspended_until && new Date(profile.suspended_until) > new Date()) {
    const until = new Date(profile.suspended_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return res.status(403).json({
      message: `Your account is suspended until ${until} due to community guideline violations.`,
      suspended: true,
      suspended_until: profile.suspended_until,
    });
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
        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          email_confirm: true,
        });
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

    // All users are on Supabase Auth — wrong password means invalid credentials
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
  const { email, password, fullName, studentId, user_type } = req.body;

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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

// ── GET ALL COMMUNITIES ───────────────────────────────────────────────────────
app.get('/api/communities', async (req, res) => {  const { data, error } = await supabaseAdmin
    .from('communities')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

// ── ADMIN: ALL DATA IN ONE SHOT ───────────────────────────────────────────────
app.get('/api/admin-data', async (req, res) => {  try {
    const [studRes, annRes, audRes, msgRes, membRes, repRes, allMsgRes, circAnnRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
      supabaseAdmin.from('audition_responses').select('*, profiles(full_name, student_id), communities(name)').order('submitted_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('memberships').select('community_id, status, created_at'),
      supabaseAdmin.from('reports').select('*, reporter:reporter_id(full_name, student_id), reported:reported_user_id(full_name, student_id)').order('created_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('announcements').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('campus_events').select('*').order('start_date', { ascending: true }),
    ]);
    res.json({
      students: studRes.data || [],
      announcements: annRes.data || [],
      auditions: audRes.data || [],
      messages: msgRes.data || [],
      memberships: membRes.data || [],
      reports: repRes.data || [],
      allMessages: allMsgRes.data || [],
      circleAnnouncements: circAnnRes.data || [],
      campusEvents: eventsRes.data || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── ADMIN: WRITE ACTIONS (events) ─────────────────────────────────────────────
app.post('/api/admin-data', async (req, res) => {
  const { action, id, ...payload } = req.body;
  try {
    if (action === 'add_event') {
      const { data, error } = await supabaseAdmin.from('campus_events').insert([payload]).select().single();
      if (error) return res.status(400).json({ message: error.message });
      return res.json({ event: data });
    }
    if (action === 'delete_event') {
      const { error } = await supabaseAdmin.from('campus_events').delete().eq('id', id);
      if (error) return res.status(400).json({ message: error.message });
      return res.json({ ok: true });
    }
    res.status(400).json({ message: 'Unknown action.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CREATE COMMUNITY ─────────────────────────────────────────────────────────
app.post('/api/communities', async (req, res) => {
  let resolvedUserId = null;

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) resolvedUserId = user.id;
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

  const { name, description, category, icon } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Circle name is required.' });

  const { data, error } = await supabaseAdmin
    .from('communities')
    .insert([{ name: name.trim(), description: description?.trim() || '', category, icon, creator_id: resolvedUserId, is_official: false }])
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ community: data });
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

// ── ADMIN: VERIFY STUDENT ─────────────────────────────────────────────────────
app.post('/api/verify-student/:id', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('profiles').update({ is_verified: true }).eq('id', req.params.id);
  if (error) return res.status(400).json(error);
  res.json({ message: 'Student verified!' });
});

// ── ADMIN: DELETE USER ────────────────────────────────────────────────────────
app.delete('/api/delete-user', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'User ID required.' });

  // Verify requester is admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('user_type').eq('id', user.id).single();
      if (profile?.user_type !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
    }
  }

  try {
    // Delete from Supabase Auth first
    await supabaseAdmin.auth.admin.deleteUser(id);
  } catch (e) {
    console.warn('[DELETE USER] Auth delete failed (may not exist):', e.message);
  }

  // Delete profile (cascades to memberships, notifications, etc.)
  const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);
  if (error) return res.status(400).json({ message: error.message });

  res.json({ message: 'User deleted successfully.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ CTU Connect server running at http://localhost:${port}`);
});
