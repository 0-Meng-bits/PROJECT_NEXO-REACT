require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

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

    return res.status(401).json({ message: 'Invalid credentials. Please check your CTU ID and password.' });
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
  const { email, password, fullName, studentId, user_type, id_photo_base64, id_photo_ext, id_verified } = req.body;

  // Clean up any orphaned DB rows from a previous failed signup attempt
  const { data: existingAccount } = await supabaseAdmin
    .from('accounts').select('id').eq('ctu_id', studentId).single();
  if (existingAccount) {
    const { data: authCheck } = await supabaseAdmin.auth.admin.getUserById(existingAccount.id);
    if (!authCheck?.user) {
      await supabaseAdmin.from('account_details').delete().eq('id', existingAccount.id);
      await supabaseAdmin.from('account_status').delete().eq('id', existingAccount.id);
      await supabaseAdmin.from('accounts').delete().eq('id', existingAccount.id);
    } else {
      return res.status(400).json({ message: 'This CTU ID is already registered.' });
    }
  }

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (authError) {
    console.error('[SIGNUP] createUser error:', authError.message);
    return res.status(400).json({ message: authError.message });
  }

  const userId = authData.user.id;

  // 2. Upload ID photo if provided
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
      } else {
        console.warn('[SIGNUP] Photo upload error:', uploadError.message);
      }
    } catch (e) {
      console.warn('[SIGNUP] Photo upload exception:', e.message);
    }
  }

  try {
    await supabaseAdmin.from('accounts').insert([{
      id: userId, ctu_id: studentId, full_name: fullName, email, user_type,
    }]);
    await supabaseAdmin.from('account_status').insert([{ id: userId, is_verified: false }]);
    await supabaseAdmin.from('account_details').upsert([{
      id: userId,
      id_photo_url: idPhotoUrl,
      id_verified: id_verified || false,
    }]);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return res.status(400).json({ message: err.message });
  }

  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });
  const user = { id: userId, student_id: studentId, full_name: fullName, email, user_type, is_verified: false, id_photo_url: idPhotoUrl };

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
    .select('*, accounts!creator_id(full_name)')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

// ── ADMIN: ALL DATA IN ONE SHOT ───────────────────────────────────────────────
app.get('/api/admin-data', async (req, res) => {  try {
    const [studRes, annRes, audRes, msgRes, membRes, repRes, allMsgRes, circAnnRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('accounts').select('*, account_status(*), account_details(*)').order('created_at', { ascending: false }),
      supabaseAdmin.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
      supabaseAdmin.from('application_submissions').select('*, accounts!applicant_id(full_name, ctu_id), communities(name)').order('submitted_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('memberships').select('community_id, status, created_at'),
      supabaseAdmin.from('reports').select('*, reporter:reporter_id(full_name, ctu_id), reported:reported_user_id(full_name, ctu_id)').order('created_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('announcements').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('campus_events').select('*').order('start_date', { ascending: true }),
    ]);
    res.json({
      students: studRes.data || [],
      announcements: annRes.data || [],
      applications: audRes.data || [],
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
      // Explicitly set community_id to NULL for campus-wide events
      const eventData = { ...payload, community_id: null };
      const { data, error } = await supabaseAdmin.from('campus_events').insert([eventData]).select().single();
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
    let accountsMap = {};
    if (creatorIds.length > 0) {
      const { data: accounts } = await supabaseAdmin
        .from('accounts').select('id, full_name, ctu_id').in('id', creatorIds);
      (accounts || []).forEach(a => { accountsMap[a.id] = { ...a, student_id: a.ctu_id }; });
    }
    const enriched = (data || []).map(r => ({ ...r, accounts: accountsMap[r.creator_id] || null }));
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
  
  const { error } = await supabaseAdmin.from('account_details')
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
      if (profile) resolvedUserId = profile.id;
    }
  }

  if (!resolvedUserId) {
    return res.status(401).json({ message: 'Unable to verify identity.' });
  }

  const { avatar } = req.body; // base64 data URL string
  if (!avatar) return res.status(400).json({ message: 'No avatar data provided.' });

  // Save base64 directly to the avatar_url column — no storage bucket needed
  const { error: updateError} = await supabaseAdmin
    .from('account_details')
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
  const userId = req.params.id;

  // Check current status to avoid double-granting
  const { data: current } = await supabaseAdmin
    .from('account_status')
    .select('is_verified, trust_points')
    .eq('id', userId)
    .single();

  const { error } = await supabaseAdmin
    .from('account_status')
    .update({ is_verified: true })
    .eq('id', userId);

  if (error) return res.status(400).json(error);

  // Grant 50 TP welcome bonus if not already verified
  if (!current?.is_verified) {
    const currentPoints = current?.trust_points || 0;
    await supabaseAdmin
      .from('account_status')
      .update({ trust_points: currentPoints + 50 })
      .eq('id', userId);

    await supabaseAdmin.from('point_transactions').insert([{
      user_id: userId,
      amount: 50,
      transaction_type: 'welcome_bonus',
      reason: 'Welcome bonus for verified student'
    }]);
  }

  res.json({ message: 'Student verified!' });
});

// ── ADMIN: DELETE USER (POST /api/delete) ────────────────────────────────────
app.post('/api/delete', async (req, res) => {
  const { action, id } = req.body;

  if (action === 'delete-user') {
    if (!id) return res.status(400).json({ error: 'Missing user id' });
    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (e) {
      console.warn('[DELETE USER] Auth delete failed:', e.message);
    }
    await supabaseAdmin.from('accounts').delete().eq('id', id);
    return res.json({ ok: true });
  }

  if (action === 'delete-community') {
    if (!id) return res.status(400).json({ error: 'Missing community id' });
    const { error } = await supabaseAdmin.from('communities').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
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

// ── CLOSE POLL & CREATE EVENT ────────────────────────────────────────────────
app.post('/api/close-poll', requireAuth, async (req, res) => {
  const { announcementId, communityId } = req.body;
  
  if (!announcementId || !communityId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'announcementId and communityId required' });
  }
  
  const closerId = req.authUser.id; // Derived from verified JWT
  
  try {
    // 1. Authorization: Verify user is community leader with approved/active status
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('memberships')
      .select('rank_level')
      .eq('user_id', closerId)
      .eq('community_id', communityId)
      .eq('status', 'active')
      .single();
    
    if (memberError || !membership || membership.rank_level <= 0) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only community leaders can close polls' });
    }
    
    // 2. Fetch poll data
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('id', announcementId)
      .single();
    
    if (pollError || !poll) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Poll not found' });
    }
    
    // 3. Verify this is actually a poll post
    if (poll.post_type !== 'poll') {
      return res.status(400).json({ error: 'INVALID_TYPE', message: 'This announcement is not a poll' });
    }
    
    // 4. Check if already closed
    if (poll.event_metadata?.is_closed) {
      return res.status(409).json({ error: 'ALREADY_CLOSED', message: 'Poll already closed' });
    }
    
    // 5. Determine winning option
    const pollOptions = poll.poll_options || [];
    const pollVotes = poll.poll_votes || {};
    
    if (pollOptions.length === 0) {
      return res.status(400).json({ error: 'INVALID_POLL', message: 'Poll has no options' });
    }
    
    // Count votes per option
    const voteCounts = {};
    pollOptions.forEach(option => {
      voteCounts[option] = (pollVotes[option] || []).length;
    });
    
    // Find max vote count
    const maxVotes = Math.max(...Object.values(voteCounts));
    
    // Find first option with max votes (handles ties and zero votes)
    let winningOption = pollOptions[0]; // Default for zero votes
    if (maxVotes > 0) {
      for (const option of pollOptions) {
        if (voteCounts[option] === maxVotes) {
          winningOption = option;
          break;
        }
      }
    }
    
    // 6. If event metadata exists, validate and generate event
    let generatedEventId = null;
    if (poll.event_metadata?.event_date) {
      try {
        const metadata = poll.event_metadata;
        
        // Validate date
        if (!metadata.event_date) throw new Error('Event date is required');
        const eventDate = new Date(metadata.event_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eventDate < today) throw new Error('Event date cannot be in the past');
        
        // Validate time format
        if (!metadata.event_time) throw new Error('Event time is required');
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(metadata.event_time)) {
          throw new Error('Event time must be in HH:MM format (24-hour)');
        }
        
        // Validate location
        if (!metadata.location || metadata.location.trim() === '') {
          throw new Error('Location is required');
        }
        if (metadata.location.length > 200) {
          throw new Error('Location cannot exceed 200 characters');
        }
        
        // Fetch creator info
        const { data: creator } = await supabaseAdmin
          .from('accounts')
          .select('id, full_name, user_type')
          .eq('id', poll.author_id)
          .single();
        
        if (!creator) throw new Error('Poll creator not found');
        
        // Create event
        const { data: newEvent, error: eventError } = await supabaseAdmin
          .from('campus_events')
          .insert({
            community_id: communityId,  // Circle-specific event (visible to members only)
            title: winningOption,
            description: `This event was created from the poll '${poll.title}' - winning option: '${winningOption}'`,
            event_date: metadata.event_date,
            event_time: `${metadata.event_time}:00`, // Convert HH:MM to HH:MM:SS
            location: metadata.location,
            poster_id: creator.id,
            poster_name: creator.full_name,
            poster_type: creator.user_type,
            category: 'social',
            is_official: false
          })
          .select()
          .single();
        
        if (eventError) throw eventError;
        generatedEventId = newEvent.id;
        
        // Notify voters
        const voterIds = new Set();
        Object.values(pollVotes).forEach(voters => {
          voters.forEach(voterId => voterIds.add(voterId));
        });
        
        if (voterIds.size > 0) {
          const notifications = Array.from(voterIds).map(voterId => ({
            user_id: voterId,
            type: 'event_from_poll',
            message: `The poll '${poll.title}' has closed! Event created: ${winningOption}`,
            link_comm_id: communityId,
            is_read: false
          }));
          
          await supabaseAdmin.from('notifications').insert(notifications);
        }
        
      } catch (validationError) {
        // If event generation fails, still close poll but notify creator
        console.error('[CLOSE POLL] Event generation failed:', validationError.message);
        await supabaseAdmin.from('notifications').insert({
          user_id: poll.author_id,
          type: 'event_generation_failed',
          message: `Your poll "${poll.title}" was closed but the event could not be created: ${validationError.message}`,
          link_comm_id: communityId
        });
      }
    }
    
    // 7. Update poll to closed status
    const { error: updateError } = await supabaseAdmin
      .from('announcements')
      .update({
        event_metadata: {
          ...poll.event_metadata,
          is_closed: true,
          closed_at: new Date().toISOString(),
          closed_by: closerId,
          winning_option: winningOption,
          ...(generatedEventId && { generated_event_id: generatedEventId })
        }
      })
      .eq('id', announcementId);
    
    if (updateError) {
      console.error('[CLOSE POLL] Update error:', updateError.message);
      return res.status(500).json({ error: 'UPDATE_FAILED', message: 'Failed to update poll status' });
    }
    
    return res.status(200).json({ success: true, eventId: generatedEventId });
    
  } catch (error) {
    console.error('[CLOSE POLL] Unexpected error:', error.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// ── SHOP ──────────────────────────────────────────────────────────────────────
app.get('/api/shop', async (req, res) => {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    if (error) throw error;
    return res.json(items || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/shop', requireAuth, async (req, res) => {
  const { action, userId, itemId, type } = req.body;

  try {
    if (action === 'get-purchases') {
      const { data, error } = await supabaseAdmin
        .from('user_purchases')
        .select('*, shop_items(*)')
        .eq('user_id', userId);
      if (error) throw error;
      return res.json(data || []);
    }

    if (action === 'get-settings') {
      const { data, error } = await supabaseAdmin
        .from('user_profile_settings')
        .select(`*, theme:active_theme(*), badge:active_badge(*), background:active_background(*), name_color:active_name_color(*), avatar_border:active_avatar_border(*), music:active_music(*)`)
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return res.json(data || null);
    }

    if (action === 'buy-item') {
      const { data: item, error: itemErr } = await supabaseAdmin
        .from('shop_items').select('*').eq('id', itemId).eq('is_active', true).single();
      if (itemErr || !item) return res.status(404).json({ error: 'Item not found' });

      const { data: existing } = await supabaseAdmin
        .from('user_purchases').select('id').eq('user_id', userId).eq('item_id', itemId).single();
      if (existing) return res.status(400).json({ error: 'You already own this item' });

      const { data: pts } = await supabaseAdmin
        .from('account_status').select('trust_points').eq('id', userId).single();
      const current = pts?.trust_points || 0;
      if (current < item.price) return res.status(400).json({ error: `Not enough trust points. You have ${current}, need ${item.price}` });

      const newPoints = current - item.price;
      const { error: ptErr } = await supabaseAdmin
        .from('account_status').update({ trust_points: newPoints }).eq('id', userId);
      if (ptErr) throw ptErr;

      const { error: purchaseErr } = await supabaseAdmin
        .from('user_purchases').insert([{ user_id: userId, item_id: itemId }]);
      if (purchaseErr) {
        await supabaseAdmin.from('account_status').update({ trust_points: current }).eq('id', userId);
        throw purchaseErr;
      }

      await supabaseAdmin.from('point_transactions').insert([{
        user_id: userId, amount: -item.price,
        transaction_type: 'shop_purchase', reason: `Bought: ${item.name}`
      }]);

      return res.json({ success: true, newPoints, item });
    }

    if (action === 'apply-customization') {
      if (itemId) {
        const { data: owned } = await supabaseAdmin
          .from('user_purchases').select('id').eq('user_id', userId).eq('item_id', itemId).single();
        if (!owned) return res.status(403).json({ error: 'You do not own this item' });
      }
      const { error } = await supabaseAdmin
        .from('user_profile_settings')
        .upsert({ user_id: userId, [`active_${type}`]: itemId, updated_at: new Date().toISOString() });
      if (error) throw error;
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Shop error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── UPLOAD MEDIA (signed URL for chat-media bucket) ──────────────────────────
app.post('/api/upload-media', async (req, res) => {
  const { userId, fileName, contentType } = req.body;
  if (!userId || !fileName) return res.status(400).json({ error: 'Missing userId or fileName.' });

  const timestamp = Date.now();
  const storagePath = `${userId}/${timestamp}-${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from('chat-media')
    .createSignedUploadUrl(storagePath);

  if (error) {
    console.error('[UPLOAD MEDIA] Signed URL error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.json({ uploadUrl: data.signedUrl, path: storagePath, token: data.token });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ CTU Connect server running at http://localhost:${port}`);
});
