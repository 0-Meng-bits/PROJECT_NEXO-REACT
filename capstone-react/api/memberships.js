import { supabaseAdmin } from './_supabase.js';
import { insertNotification } from './_notifications.js';

// Helper: resolve user ID from Authorization header
async function getAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// Helper: promote next leader when current leader leaves/is banned
async function promoteNextLeader(communityId, departingUserId) {
  // Try to promote oldest co-leader (rank_level=2)
  const { data: coLeaders } = await supabaseAdmin
    .from('memberships')
    .select('id, user_id, created_at')
    .eq('community_id', communityId)
    .eq('rank_level', 2)
    .eq('status', 'active')
    .neq('user_id', departingUserId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (coLeaders?.length) {
    const promoted = coLeaders[0];
    await supabaseAdmin.from('memberships')
      .update({ rank_level: 3 })
      .eq('id', promoted.id);
    await insertNotification({
      userId: promoted.user_id,
      type: 'promoted',
      message: `You have been promoted to Leader of this circle.`,
      category: 'Circles',
    });
    return promoted.user_id;
  }

  // Fall back: promote longest-standing active member
  const { data: members } = await supabaseAdmin
    .from('memberships')
    .select('id, user_id, created_at')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .neq('user_id', departingUserId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (members?.length) {
    const promoted = members[0];
    await supabaseAdmin.from('memberships')
      .update({ rank_level: 3 })
      .eq('id', promoted.id);
    await insertNotification({
      userId: promoted.user_id,
      type: 'promoted',
      message: `You have been promoted to Leader of this circle.`,
      category: 'Circles',
    });
    return promoted.user_id;
  }

  return null;
}

// Helper: auto-dissolve a pending circle
async function dissolvePendingCircle(communityId, circleName) {
  // Get all pending invitees to notify
  const { data: pendingMembers } = await supabaseAdmin
    .from('memberships')
    .select('user_id')
    .eq('community_id', communityId)
    .eq('status', 'pending');

  // Delete the community (cascades to memberships)
  await supabaseAdmin.from('communities').delete().eq('id', communityId);

  // Notify all pending invitees
  for (const m of (pendingMembers || [])) {
    await insertNotification({
      userId: m.user_id,
      type: 'circle_dissolved',
      message: `The circle "${circleName}" was dissolved before it could be activated.`,
      category: 'Circles',
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const { action, community_id } = req.body;

  // ── ACCEPT INVITE — accept a circle invite ──
  if (action === 'accept_invite') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    // Update membership status from pending to active
    const { data: membership, error } = await supabaseAdmin
      .from('memberships')
      .update({ status: 'active' })
      .eq('community_id', community_id)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !membership) return res.status(400).json({ message: 'No pending invite found.' });

    // Check if circle now has 3+ active members → activate it
    const { count } = await supabaseAdmin
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community_id)
      .eq('status', 'active');

    if (count >= 3) {
      // Activate the circle
      await supabaseAdmin
        .from('communities')
        .update({ status: 'active' })
        .eq('id', community_id)
        .eq('status', 'pending');

      // Promote creator to Leader (rank_level=3)
      const { data: community } = await supabaseAdmin
        .from('communities')
        .select('creator_id, name')
        .eq('id', community_id)
        .single();

      if (community?.creator_id) {
        await supabaseAdmin
          .from('memberships')
          .update({ rank_level: 3 })
          .eq('community_id', community_id)
          .eq('user_id', community.creator_id);
      }
    }

    return res.json({ success: true, activated: count >= 3 });
  }

  // ── DECLINE INVITE — decline a circle invite ──
  if (action === 'decline_invite') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    await supabaseAdmin
      .from('memberships')
      .delete()
      .eq('community_id', community_id)
      .eq('user_id', userId)
      .eq('status', 'pending');

    return res.json({ success: true });
  }

  // ── LEAVE — leave a circle ──
  if (action === 'leave') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    // Get current membership and community info
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('id, rank_level, status')
      .eq('community_id', community_id)
      .eq('user_id', userId)
      .single();

    if (!membership) return res.status(404).json({ message: 'Membership not found.' });

    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('name, status, creator_id')
      .eq('id', community_id)
      .single();

    // Delete the membership
    await supabaseAdmin.from('memberships').delete().eq('id', membership.id);

    if (community?.status === 'pending') {
      // Pending circle — auto-dissolve if leader leaves
      if (community.creator_id === userId) {
        await dissolvePendingCircle(community_id, community.name);
        return res.json({ success: true, dissolved: true });
      }
    } else {
      // Active circle — handle leader succession
      if (membership.rank_level === 3) {
        await promoteNextLeader(community_id, userId);
      }
    }

    return res.json({ success: true });
  }

  // ── CANCEL CIRCLE — creator cancels a pending circle ──
  if (action === 'cancel_circle') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    const { data: community } = await supabaseAdmin
      .from('communities')
      .select('name, creator_id, status')
      .eq('id', community_id)
      .single();

    if (!community) return res.status(404).json({ message: 'Circle not found.' });
    if (community.creator_id !== userId) return res.status(403).json({ message: 'Only the creator can cancel this circle.' });
    if (community.status !== 'pending') return res.status(400).json({ message: 'Only pending circles can be cancelled.' });

    await dissolvePendingCircle(community_id, community.name);
    return res.json({ success: true, dissolved: true });
  }

  return res.status(400).json({ message: 'Unknown action.' });
}
