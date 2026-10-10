import { supabaseAdmin } from './_supabase.js';

// Helper: resolve user ID from Authorization header
async function getAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// Helper: insert a notification using the grouping/muting logic
async function insertNotification({ userId, type, message, groupKey, category }) {
  if (!userId) return;

  // Check if user has muted this category
  const { data: mute } = await supabaseAdmin
    .from('notification_mutes')
    .select('user_id')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();
  if (mute) return; // muted — skip insert

  // Check for existing grouped notification within last 10 minutes
  if (groupKey) {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id, group_count, message')
      .eq('user_id', userId)
      .eq('group_key', groupKey)
      .eq('is_read', false)
      .gte('created_at', tenMinsAgo)
      .maybeSingle();

    if (existing) {
      const newCount = (existing.group_count || 1) + 1;
      const baseMsg = message.replace(/^\d+ people/, `${newCount} people`);
      await supabaseAdmin
        .from('notifications')
        .update({ group_count: newCount, message: baseMsg })
        .eq('id', existing.id);
      return;
    }
  }

  await supabaseAdmin.from('notifications').insert([{
    user_id: userId,
    type,
    message,
    group_key: groupKey || null,
    group_count: 1,
    category,
  }]);
}

export default async function handler(req, res) {
  const userId = await getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  // ── GET — list viewer's connections and pending requests ──
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('connections')
      .select(`
        id, user_id, connected_user_id, status, created_at, updated_at,
        requester:accounts!user_id(id, full_name, ctu_id),
        recipient:accounts!connected_user_id(id, full_name, ctu_id)
      `)
      .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`);

    if (error) return res.status(400).json({ message: error.message });
    return res.json(data || []);
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { action, to, connection_id, target_id } = req.body;

  // ── REQUEST — send a connection request ──
  if (action === 'request') {
    if (!to) return res.status(400).json({ message: 'Missing target user.' });
    if (to === userId) return res.status(400).json({ message: 'Cannot connect with yourself.' });

    // Check no existing pending connection in either direction
    const { data: existing } = await supabaseAdmin
      .from('connections')
      .select('id, status, updated_at')
      .or(
        `and(user_id.eq.${userId},connected_user_id.eq.${to}),and(user_id.eq.${to},connected_user_id.eq.${userId})`
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pending') {
        return res.status(400).json({ message: 'A pending request already exists.' });
      }
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: 'You are already connected.' });
      }
      if (existing.status === 'declined') {
        // Enforce 7-day cooldown after decline
        const declinedAt = new Date(existing.updated_at);
        const daysSince = (Date.now() - declinedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          const daysLeft = Math.ceil(7 - daysSince);
          return res.status(400).json({
            message: `You cannot send another request for ${daysLeft} more day${daysLeft !== 1 ? 's' : ''}.`,
          });
        }
        // Cooldown passed — delete old declined record before creating new one
        await supabaseAdmin.from('connections').delete().eq('id', existing.id);
      }
    }

    // Check if target has blocked viewer
    const { data: block } = await supabaseAdmin
      .from('blocks')
      .select('id')
      .eq('blocker_id', to)
      .eq('blocked_id', userId)
      .maybeSingle();
    if (block) return res.status(403).json({ message: 'Unable to send request.' });

    const { data: conn, error } = await supabaseAdmin
      .from('connections')
      .insert([{ user_id: userId, connected_user_id: to, status: 'pending' }])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    // Get requester name for notification
    const { data: requester } = await supabaseAdmin
      .from('accounts')
      .select('full_name')
      .eq('id', userId)
      .single();

    await insertNotification({
      userId: to,
      type: 'connection_request',
      message: `${requester?.full_name || 'Someone'} sent you a connection request.`,
      groupKey: `connection_request_${to}`,
      category: 'Connections',
    });

    return res.json({ connection: conn });
  }

  // ── ACCEPT — accept a connection request ──
  if (action === 'accept') {
    if (!connection_id) return res.status(400).json({ message: 'Missing connection_id.' });

    const { data: conn, error } = await supabaseAdmin
      .from('connections')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', connection_id)
      .eq('connected_user_id', userId) // only recipient can accept
      .select()
      .single();

    if (error || !conn) return res.status(400).json({ message: error?.message || 'Not found.' });

    const { data: accepter } = await supabaseAdmin
      .from('accounts')
      .select('full_name')
      .eq('id', userId)
      .single();

    await insertNotification({
      userId: conn.user_id,
      type: 'connection_accepted',
      message: `${accepter?.full_name || 'Someone'} accepted your connection request.`,
      groupKey: `connection_accepted_${conn.user_id}`,
      category: 'Connections',
    });

    return res.json({ connection: conn });
  }

  // ── DECLINE — decline a connection request ──
  if (action === 'decline') {
    if (!connection_id) return res.status(400).json({ message: 'Missing connection_id.' });

    const { data: conn, error } = await supabaseAdmin
      .from('connections')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', connection_id)
      .eq('connected_user_id', userId)
      .select()
      .single();

    if (error || !conn) return res.status(400).json({ message: error?.message || 'Not found.' });
    return res.json({ connection: conn });
  }

  // ── REMOVE — remove an accepted connection ──
  if (action === 'remove') {
    if (!connection_id) return res.status(400).json({ message: 'Missing connection_id.' });

    const { error } = await supabaseAdmin
      .from('connections')
      .delete()
      .eq('id', connection_id)
      .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`);

    if (error) return res.status(400).json({ message: error.message });
    // NOTE: memberships are intentionally NOT touched — circle membership persists after disconnect
    return res.json({ success: true });
  }

  // ── BLOCK — block a user ──
  if (action === 'block') {
    if (!target_id) return res.status(400).json({ message: 'Missing target_id.' });
    if (target_id === userId) return res.status(400).json({ message: 'Cannot block yourself.' });

    // Insert block record (ignore if already blocked)
    const { error: blockError } = await supabaseAdmin
      .from('blocks')
      .upsert([{ blocker_id: userId, blocked_id: target_id }], { onConflict: 'blocker_id,blocked_id' });
    if (blockError) return res.status(400).json({ message: blockError.message });

    // Remove any existing connection between the pair
    await supabaseAdmin
      .from('connections')
      .delete()
      .or(
        `and(user_id.eq.${userId},connected_user_id.eq.${target_id}),and(user_id.eq.${target_id},connected_user_id.eq.${userId})`
      );

    return res.json({ success: true });
  }

  // ── UNBLOCK — remove a block ──
  if (action === 'unblock') {
    if (!target_id) return res.status(400).json({ message: 'Missing target_id.' });

    const { error } = await supabaseAdmin
      .from('blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', target_id);

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ success: true });
  }

  return res.status(400).json({ message: 'Unknown action.' });
}
