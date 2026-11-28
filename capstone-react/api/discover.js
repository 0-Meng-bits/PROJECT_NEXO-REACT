import { supabaseAdmin } from './_supabase.js';

// Helper: resolve user ID from Authorization header
async function getAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const userId = await getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  // 1. Get viewer's own interests for suggested ordering
  const { data: viewerInterests } = await supabaseAdmin
    .from('user_interests')
    .select('interest')
    .eq('user_id', userId);
  const viewerInterestList = (viewerInterests || []).map(r => r.interest);

  // 2. Get all users the viewer has blocked or been blocked by
  const { data: blocks } = await supabaseAdmin
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  const blockedIds = new Set(
    (blocks || []).map(b => b.blocker_id === userId ? b.blocked_id : b.blocker_id)
  );

  // 3. Get viewer's existing connections (to show connection status on cards)
  const { data: connections } = await supabaseAdmin
    .from('connections')
    .select('id, user_id, connected_user_id, status')
    .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`);

  const connectionMap = {};
  (connections || []).forEach(c => {
    const otherId = c.user_id === userId ? c.connected_user_id : c.user_id;
    const isSender = c.user_id === userId; // true = viewer sent the request
    connectionMap[otherId] = { connection_id: c.id, status: c.status, is_sender: isSender };
  });

  const acceptedConnectionIds = new Set(
    Object.entries(connectionMap)
      .filter(([, v]) => v.status === 'accepted')
      .map(([id]) => id)
  );

  // 4. Fetch all verified, non-banned, discoverable users (with or without interests)
  const [accountsRes, statusesRes, detailsRes, interestsRes] = await Promise.all([
    supabaseAdmin.from('accounts').select('id, full_name, ctu_id, user_type'),
    supabaseAdmin.from('account_status').select('id, is_verified, is_banned'),
    supabaseAdmin.from('account_details').select('id, program, avatar_url, discoverable'),
    supabaseAdmin.from('user_interests').select('user_id, interest'),
  ]);

  if (accountsRes.error) {
    console.error('[DISCOVER] accountsError:', accountsRes.error);
    return res.status(400).json({ message: accountsRes.error.message });
  }

  const interestsByUser = {};
  (interestsRes.data || []).forEach(r => {
    if (!interestsByUser[r.user_id]) interestsByUser[r.user_id] = [];
    interestsByUser[r.user_id].push(r.interest);
  });

  const detailMap = {};
  (detailsRes.data || []).forEach(d => { detailMap[d.id] = d; });

  const statusMap = {};
  (statusesRes.data || []).forEach(s => { statusMap[s.id] = s; });

  // 5. Filter and map to user cards (all non-banned, discoverable students)
  const userCards = (accountsRes.data || [])
    .filter(acc => {
      const id = acc.id;
      const status = statusMap[id];
      const detail = detailMap[id];
      if (acc.user_type === 'Admin') return false;
      if (status?.is_banned) return false;
      if (detail?.discoverable === false) return false;
      if (id === userId) return false;
      if (blockedIds.has(id)) return false;
      return true;
    })
    .map(acc => {
      const id = acc.id;
      const d = detailMap[id] || {};
      const s = statusMap[id] || {};
      const interests = interestsByUser[id] || [];
      const sharedInterests = viewerInterestList.filter(i => interests.includes(i));
      const connInfo = connectionMap[id] || null;
      return {
        id,
        full_name: acc.full_name || '',
        ctu_id: acc.ctu_id || '',
        user_type: acc.user_type || 'Student',
        program: d.program || '',
        avatar_url: d.avatar_url || null,
        is_verified: Boolean(s.is_verified),
        interests,
        shared_interest_count: sharedInterests.length,
        connection_status: connInfo?.status || null,
        connection_id: connInfo?.connection_id || null,
        is_sender: connInfo?.is_sender ?? null,
      };
    });

  // 6. Sort: shared interests desc, then by name
  userCards.sort((a, b) => {
    if (b.shared_interest_count !== a.shared_interest_count) {
      return b.shared_interest_count - a.shared_interest_count;
    }
    return a.full_name.localeCompare(b.full_name);
  });

  // 7. Fetch open circles with membership info (compatible with both community_interests and legacy interest_tag)
  const [{ data: openCircles }, { data: commInterests }] = await Promise.all([
    supabaseAdmin
      .from('communities')
      .select('id, name, description, category, is_open, status, memberships(user_id, status)')
      .eq('is_open', true)
      .eq('status', 'active'),
    supabaseAdmin
      .from('community_interests')
      .select('community_id, interest'),
  ]);

  const commIntMap = {};
  (commInterests || []).forEach(r => {
    if (!commIntMap[r.community_id]) commIntMap[r.community_id] = [];
    commIntMap[r.community_id].push(r.interest);
  });

  const circleCards = (openCircles || []).map(c => {
    const memberIds = new Set(
      (c.memberships || [])
        .filter(m => m.status === 'active')
        .map(m => m.user_id)
    );
    const hasConnectedMember = [...acceptedConnectionIds].some(id => memberIds.has(id));
    const isMember = memberIds.has(userId);
    const tags = commIntMap[c.id] || [];
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      interest_tags: tags,
      interest_tag: tags.join(','),
      member_count: memberIds.size,
      has_connected_member: hasConnectedMember,
      is_member: isMember,
    };
  });

  // Sort open circles: ones with connections first
  circleCards.sort((a, b) => (b.has_connected_member ? 1 : 0) - (a.has_connected_member ? 1 : 0));

  return res.json({ users: userCards, circles: circleCards });
}
