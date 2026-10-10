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
  const { data: viewerDetails } = await supabaseAdmin
    .from('account_details')
    .select('interests')
    .eq('id', userId)
    .single();
  const viewerInterests = viewerDetails?.interests || [];

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
    connectionMap[otherId] = { connection_id: c.id, status: c.status };
  });

  const acceptedConnectionIds = new Set(
    Object.entries(connectionMap)
      .filter(([, v]) => v.status === 'accepted')
      .map(([id]) => id)
  );

  // 4. Fetch discoverable users with interests — query account_details, accounts, and account_status separately
  const { data: details, error: detailsError } = await supabaseAdmin
    .from('account_details')
    .select('id, interests, course')
    .not('interests', 'is', null)
    .eq('discoverable', true);

  if (detailsError) {
    console.error('[DISCOVER] detailsError:', detailsError);
    return res.status(400).json({ message: detailsError.message });
  }

  if (!details || details.length === 0) {
    return res.json({ users: [], circles: [] });
  }

  const detailIds = details.map(d => d.id);

  // Fetch accounts for these IDs
  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, full_name, ctu_id, user_type')
    .in('id', detailIds);

  if (accountsError) {
    console.error('[DISCOVER] accountsError:', accountsError);
    return res.status(400).json({ message: accountsError.message });
  }

  // Fetch account_status for these IDs
  const { data: statuses } = await supabaseAdmin
    .from('account_status')
    .select('id, is_verified, is_banned')
    .in('id', detailIds);

  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });
  const statusMap = {};
  (statuses || []).forEach(s => { statusMap[s.id] = s; });

  // 5. Filter and map to user cards
  const userCards = details
    .filter(d => {
      const status = statusMap[d.id];
      if (!status?.is_verified) return false;
      if (status?.is_banned) return false;
      if (!d.interests || d.interests.length === 0) return false;
      if (d.id === userId) return false;
      if (blockedIds.has(d.id)) return false;
      return true;
    })
    .map(d => {
      const acc = accountMap[d.id] || {};
      const sharedInterests = viewerInterests.filter(i => d.interests.includes(i));
      const connInfo = connectionMap[d.id] || null;
      return {
        id: d.id,
        full_name: acc.full_name || '',
        ctu_id: acc.ctu_id || '',
        user_type: acc.user_type || 'Student',
        course: d.course || '',
        interests: d.interests || [],
        shared_interest_count: sharedInterests.length,
        connection_status: connInfo?.status || null,
        connection_id: connInfo?.connection_id || null,
      };
    });

  // 6. Sort: shared interests desc, then by name
  userCards.sort((a, b) => {
    if (b.shared_interest_count !== a.shared_interest_count) {
      return b.shared_interest_count - a.shared_interest_count;
    }
    return a.full_name.localeCompare(b.full_name);
  });

  // 7. Fetch open circles with membership info for connection-highlight
  const { data: openCircles } = await supabaseAdmin
    .from('communities')
    .select(`
      id, name, description, category, interest_tag, is_open, status,
      memberships(user_id, status)
    `)
    .eq('is_open', true)
    .eq('status', 'active');

  const circleCards = (openCircles || []).map(c => {
    const memberIds = new Set(
      (c.memberships || [])
        .filter(m => m.status === 'active')
        .map(m => m.user_id)
    );
    const hasConnectedMember = [...acceptedConnectionIds].some(id => memberIds.has(id));
    const isMember = memberIds.has(userId);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      interest_tag: c.interest_tag,
      member_count: memberIds.size,
      has_connected_member: hasConnectedMember,
      is_member: isMember,
    };
  });

  // Sort open circles: ones with connections first
  circleCards.sort((a, b) => (b.has_connected_member ? 1 : 0) - (a.has_connected_member ? 1 : 0));

  return res.json({ users: userCards, circles: circleCards });
}
