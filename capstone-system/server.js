require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

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
      .from('accounts').select('user_type').eq('id', req.authUser.id).single();
    if (data?.user_type !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
  });
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { studentId, password } = req.body;

  // 1. Find account by ctu_id + join status and details
  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .select('*, account_status(*), account_details(*)')
    .eq('ctu_id', studentId)
    .single();

  if (accountError || !account) {
    return res.status(401).json({ message: 'CTU_ID not found in the system.' });
  }

  const status = account.account_status || {};
  const details = account.account_details || {};

  // Check if permanently banned
  if (status.is_banned) {
    return res.status(403).json({
      message: 'Your account has been permanently banned due to serious violations. Contact the administrator if you believe this is a mistake.',
      banned: true,
    });
  }

  // Check if suspended
  if (status.suspended_until && new Date(status.suspended_until) > new Date()) {
    const until = new Date(status.suspended_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return res.status(403).json({
      message: `Your account is suspended until ${until} due to community guideline violations.`,
      suspended: true,
      suspended_until: status.suspended_until,
    });
  }

  const isPending = !status.is_verified;

  // 2. Sign in via Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (authError) {
    console.error('[LOGIN] signInWithPassword error:', authError.message, authError.status);

    if (authError.message?.includes('Email not confirmed')) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(account.id, { email_confirm: true });
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email: account.email, password });
        if (retryError) return res.status(401).json({ message: 'Invalid credentials.' });
        // Build flat profile-compatible object
        const user = { ...account, student_id: account.ctu_id, is_verified: status.is_verified, ...details };
        return res.json({ message: isPending ? 'Pending approval' : 'Authentication successful', user, session: retryData.session, pending: isPending });
      } catch (confirmErr) {
        return res.status(401).json({ message: 'Login failed. Please contact admin.' });
      }
    }

    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  // Build flat profile-compatible response (same shape as before so frontend doesn't break)
  const user = {
    ...account,
    student_id: account.ctu_id,       // alias for backwards compat
    is_verified: status.is_verified,
    is_banned: status.is_banned,
    suspended_until: status.suspended_until,
    warning_count: status.warning_count,
    trust_points: status.trust_points,
    course: details.course,
    year_level: details.year_level,
    interests: details.interests,
    avatar_url: details.avatar_url,
    cover_url: details.cover_url,
    id_photo_url: details.id_photo_url,
    last_seen: details.last_seen,
    onboarding_complete: details.onboarding_complete,
  };
  // Remove nested objects from response
  delete user.account_status;
  delete user.account_details;

  res.json({
    message: isPending ? 'Pending approval' : 'Authentication successful',
    user,
    session: authData.session,
    pending: isPending,
  });
});

// ── SIGNUP ────────────────────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { email, password, fullName, studentId, user_type } = req.body;

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (authError) {
    console.error('[SIGNUP] createUser error:', authError.message);
    return res.status(400).json({ message: authError.message });
  }

  const userId = authData.user.id;

  try {
    // 2a. Insert into accounts
    await supabaseAdmin.from('accounts').insert([{
      id: userId, ctu_id: studentId, full_name: fullName, email, user_type,
    }]);

    // 2b. Insert into account_status
    await supabaseAdmin.from('account_status').insert([{ id: userId, is_verified: false }]);

    // 2c. Insert into account_details
    await supabaseAdmin.from('account_details').insert([{ id: userId }]);

    // 2d. Keep profiles in sync for backwards compat during transition
    await supabaseAdmin.from('profiles').insert([{
      id: userId, student_id: studentId, full_name: fullName, email, user_type, is_verified: false,
    }]);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return res.status(400).json({ message: err.message });
  }

  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });
  const user = { id: userId, student_id: studentId, full_name: fullName, email, user_type, is_verified: false };

  res.status(200).json({ message: 'Awaiting approval', user, session: sessionData?.session || null });
});

// ── SESSION VERIFY (frontend calls this to validate stored session) ────────────
app.get('/api/me', requireAuth, async (req, res) => {
  const { data: account } = await supabaseAdmin
    .from('accounts').select('*, account_status(*), account_details(*)')
    .eq('id', req.authUser.id).single();
  if (!account) return res.status(404).json({ message: 'Profile not found.' });
  const status = account.account_status || {};
  const details = account.account_details || {};
  const user = { ...account, student_id: account.ctu_id, is_verified: status.is_verified, is_banned: status.is_banned, suspended_until: status.suspended_until, warning_count: status.warning_count, trust_points: status.trust_points, ...details };
  delete user.account_status; delete user.account_details;
  res.json({ user });
});

// ── ADMIN: GET ALL STUDENTS ───────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: 'Invalid session.' });
    const { data: acct } = await supabaseAdmin.from('accounts').select('user_type').eq('id', user.id).single();
    if (acct?.user_type !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
  }
  // Join accounts + account_status + account_details, return flat profile-compatible shape
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('*, account_status(*), account_details(*)')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json(error);
  const flat = (data || []).map(a => ({
    ...a,
    student_id: a.ctu_id,
    is_verified: a.account_status?.is_verified,
    is_banned: a.account_status?.is_banned,
    suspended_until: a.account_status?.suspended_until,
    warning_count: a.account_status?.warning_count,
    trust_points: a.account_status?.trust_points,
    ...(a.account_details || {}),
  }));
  res.json(flat);
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
      supabaseAdmin.from('accounts').select('*, account_status(*), account_details(*)').order('created_at', { ascending: false }),
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

// ── CIRCLE REQUESTS (admin) ───────────────────────────────────────────────────
app.get('/api/circle-requests', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('circle_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[CIRCLE-REQUESTS GET]', error.message);
      return res.status(500).json({ message: error.message });
    }
    // Enrich with creator profile info
    const creatorIds = [...new Set((data || []).map(r => r.creator_id).filter(Boolean))];
    let profileMap = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('accounts').select('id, full_name, ctu_id').in('id', creatorIds);
      (profiles || []).forEach(p => { profileMap[p.id] = { ...p, student_id: p.ctu_id }; });
    }
    const enriched = (data || []).map(r => ({ ...r, profiles: profileMap[r.creator_id] || null }));
    res.json(enriched);
  } catch (err) {
    console.error('[CIRCLE-REQUESTS GET] Unexpected:', err.message);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/circle-requests/approve', async (req, res) => {
  const { requestId, adminId } = req.body;
  if (!requestId) return res.status(400).json({ message: 'Missing requestId.' });

  // Fetch the request
  const { data: cr, error: crErr } = await supabaseAdmin
    .from('circle_requests').select('*').eq('id', requestId).single();
  if (crErr || !cr) return res.status(404).json({ message: 'Request not found.' });

  // Create the actual community
  const { data: comm, error: commErr } = await supabaseAdmin
    .from('communities')
    .insert([{ name: cr.name, description: cr.description, category: cr.category, icon: cr.icon, creator_id: cr.creator_id, is_official: false }])
    .select().single();
  if (commErr) return res.status(500).json({ message: commErr.message });

  // Auto-add creator as active member (leader)
  await supabaseAdmin.from('memberships').insert([{ community_id: comm.id, user_id: cr.creator_id, rank_level: 3, status: 'active' }]);

  // Mark approved
  await supabaseAdmin.from('circle_requests').update({
    status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: adminId || null,
  }).eq('id', requestId);

  // Notify creator
  await supabaseAdmin.from('notifications').insert([{
    user_id: cr.creator_id, type: 'join_approved',
    message: `Your circle "${cr.name}" has been approved! You can now find it in your circles.`,
    link_comm_id: comm.id,
  }]);

  res.json({ ok: true, community: comm });
});

app.post('/api/circle-requests/reject', async (req, res) => {
  const { requestId, adminId, note } = req.body;
  if (!requestId) return res.status(400).json({ message: 'Missing requestId.' });

  const { data: cr } = await supabaseAdmin.from('circle_requests').select('*').eq('id', requestId).single();
  if (!cr) return res.status(404).json({ message: 'Request not found.' });

  await supabaseAdmin.from('circle_requests').update({
    status: 'rejected', admin_note: note || '', reviewed_at: new Date().toISOString(), reviewed_by: adminId || null,
  }).eq('id', requestId);

  await supabaseAdmin.from('notifications').insert([{
    user_id: cr.creator_id, type: 'join_denied',
    message: `Your circle request "${cr.name}" was not approved.${note ? ` Reason: ${note}` : ''}`,
  }]);

  res.json({ ok: true });
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

  // Submit to circle_requests for admin approval instead of creating directly
  const { data, error } = await supabaseAdmin
    .from('circle_requests')
    .insert([{ name: name.trim(), description: description?.trim() || '', category, icon, creator_id: resolvedUserId, status: 'pending' }])
    .select()
    .single();

  if (error) {
    console.error('[CIRCLE REQUEST] Insert error:', error.message, '| userId:', resolvedUserId);
    return res.status(400).json({ message: error.message });
  }
  console.log('[CIRCLE REQUEST] Submitted:', data.id, name.trim(), 'by', resolvedUserId);
  res.json({ request: data, pending: true });
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

  // Delete related data first to avoid FK constraint violations
  await supabaseAdmin.from('memberships').delete().eq('community_id', id);
  await supabaseAdmin.from('messages').delete().eq('community_id', id);
  await supabaseAdmin.from('announcements').delete().eq('community_id', id);
  await supabaseAdmin.from('channels').delete().eq('community_id', id);

  const { error: deleteError } = await supabaseAdmin
    .from('communities').delete().eq('id', id);

  if (deleteError) return res.status(400).json({ message: deleteError.message });

  res.json({ message: 'Circle deleted successfully.' });
});

// ── UPLOAD CIRCLE COVER PHOTO ────────────────────────────────────────────────
app.post('/api/upload-cover', async (req, res) => {
  const communityId = req.body.communityId || req.query.communityId;
  if (!communityId) return res.status(400).json({ message: 'Missing communityId.' });

  // Build update — supports cover-only or full settings update
  const updates = {};
  if (req.body.cover !== undefined)       updates.cover_url   = req.body.cover;
  if (req.body.cover_url !== undefined)   updates.cover_url   = req.body.cover_url;
  if (req.body.logo_url !== undefined)    updates.logo_url    = req.body.logo_url;
  if (req.body.name !== undefined)        updates.name        = req.body.name;
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.category !== undefined)    updates.category    = req.body.category;

  if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'Nothing to update.' });

  const { error: updateError } = await supabaseAdmin
    .from('communities').update(updates).eq('id', communityId);

  if (updateError) {
    console.error('[UPLOAD COVER] DB update error:', updateError.message);
    return res.status(500).json({ message: 'Failed to save: ' + updateError.message });
  }

  console.log('[UPLOAD COVER] Saved for community', communityId, Object.keys(updates));
  res.json({ ok: true });
});

// ── PRESENCE HEARTBEAT ────────────────────────────────────────────────────────
app.post('/api/heartbeat', async (req, res) => {
  const userId = req.body.userId || req.query.userId;
  if (!userId) return res.status(400).json({ message: 'Missing userId.' });
  const { error } = await supabaseAdmin.from('profiles')
    .update({ last_seen: new Date().toISOString() }).eq('id', userId);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ ok: true });
});

// ── UPDATE PROFILE (last_seen heartbeat + profile fields) ─────────────────────
app.post('/api/update-profile', async (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'] || req.body?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const detailFields = ['course', 'year_level', 'interests', 'last_seen', 'cover_url', 'avatar_url'];
  const detailUpdates = {};
  detailFields.forEach(k => { if (req.body[k] !== undefined) detailUpdates[k] = req.body[k]; });

  if (!Object.keys(detailUpdates).length) return res.status(400).json({ message: 'Nothing to update.' });

  // Update new table
  const { error } = await supabaseAdmin.from('account_details').update(detailUpdates).eq('id', userId);
  // Keep profiles in sync
  await supabaseAdmin.from('profiles').update(detailUpdates).eq('id', userId);

  if (error) return res.status(500).json({ message: error.message });
  res.json({ ok: true });
});

// ── EDIT MESSAGE ─────────────────────────────────────────────────────────────
app.patch('/api/messages', async (req, res) => {
  const { id, content, studentId } = req.body;
  if (!id || !content?.trim() || !studentId) return res.status(400).json({ message: 'Missing fields.' });

  try {
    // Verify the message belongs to this student
    const { data: msg, error: fetchErr } = await supabaseAdmin.from('messages').select('student_id').eq('id', id).single();
    if (fetchErr) { console.error('[EDIT MSG] fetch error:', fetchErr.message); return res.status(500).json({ message: fetchErr.message }); }
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    if (String(msg.student_id) !== String(studentId)) return res.status(403).json({ message: 'Not your message.' });

    const { error } = await supabaseAdmin.from('messages').update({ content: content.trim(), edited: true }).eq('id', id);
    if (error) { console.error('[EDIT MSG] update error:', error.message); return res.status(500).json({ message: error.message }); }
    res.json({ ok: true });
  } catch (err) {
    console.error('[EDIT MSG] unexpected:', err.message);
    res.status(500).json({ message: err.message });
  }
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
    .from('account_details')
    .update({ avatar_url: avatar })
    .eq('id', resolvedUserId);
  // keep profiles in sync
  await supabaseAdmin.from('profiles').update({ avatar_url: avatar }).eq('id', resolvedUserId);

  if (updateError) {
    console.error('[UPLOAD AVATAR] Profile update error:', updateError.message);
    return res.status(500).json({ message: 'Failed to save avatar.' });
  }

  res.json({ url: avatar });
});

// ── ADMIN: VERIFY STUDENT ─────────────────────────────────────────────────────
app.post('/api/verify-student/:id', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('account_status').update({ is_verified: true }).eq('id', req.params.id);
  // keep profiles in sync
  await supabaseAdmin.from('profiles').update({ is_verified: true }).eq('id', req.params.id);
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
      const { data: profile } = await supabaseAdmin.from('accounts').select('user_type').eq('id', user.id).single();
      if (profile?.user_type !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
    }
  }

  try {
    // Delete from Supabase Auth first
    await supabaseAdmin.auth.admin.deleteUser(id);
  } catch (e) {
    console.warn('[DELETE USER] Auth delete failed (may not exist):', e.message);
  }

  // Delete from new tables (cascade handles account_status and account_details)
  await supabaseAdmin.from('accounts').delete().eq('id', id);
  // Also delete from profiles for backwards compat
  const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);
  if (error) return res.status(400).json({ message: error.message });

  res.json({ message: 'User deleted successfully.' });
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'CTU ID is required.' });

  const { data: profile, error } = await supabaseAdmin
    .from('accounts').select('email').eq('ctu_id', studentId).single();
  if (error || !profile) return res.status(404).json({ message: 'CTU ID not found.' });

  const siteUrl = process.env.SITE_URL || 'http://localhost:5173';

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo: `${siteUrl}/reset-password` },
  });
  if (linkError) return res.status(400).json({ message: linkError.message });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"NEXO Connect" <${process.env.GMAIL_USER}>`,
      to: profile.email,
      subject: 'Reset your NEXO Connect password',
      html: `
        <div style="font-family:monospace;background:#0d0d12;color:white;padding:32px;border-radius:8px;">
          <h2 style="color:#00f0ff;letter-spacing:2px;">NEXO CONNECT</h2>
          <p>You requested a password reset. Click the link below:</p>
          <a href="${linkData.properties.action_link}"
             style="display:inline-block;margin:16px 0;padding:12px 24px;background:#f5e642;color:#0d0d12;font-weight:bold;text-decoration:none;border-radius:4px;">
            RESET PASSWORD
          </a>
          <p style="color:#666;font-size:12px;">This link expires in 1 hour.</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('[FORGOT PASSWORD] Email error:', emailErr.message);
    return res.status(400).json({ message: 'Failed to send reset email.' });
  }

  res.json({ message: 'Password reset email sent.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ CTU Connect server running at http://localhost:${port}`);
});
