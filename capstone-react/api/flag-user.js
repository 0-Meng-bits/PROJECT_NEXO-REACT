import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { flaggerId, flaggedUserId, communityId, reason, severity } = req.body;

  if (!flaggerId || !flaggedUserId || !communityId || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Verify flagger is a leader/co-leader in the community
    const { data: membership } = await supabase
      .from('memberships')
      .select('rank_level')
      .eq('user_id', flaggerId)
      .eq('community_id', communityId)
      .single();

    if (!membership || membership.rank_level < 2) {
      return res.status(403).json({ error: 'Only leaders and co-leaders can flag users' });
    }

    // 2. Check if already flagged by this user recently
    const { data: recentFlag } = await supabase
      .from('user_flags')
      .select('id')
      .eq('flagger_id', flaggerId)
      .eq('flagged_user_id', flaggedUserId)
      .eq('community_id', communityId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (recentFlag) {
      return res.status(400).json({ error: 'You already flagged this user this week' });
    }

    // 3. Create flag
    const { data: flag, error: flagError } = await supabase
      .from('user_flags')
      .insert([{
        flagged_user_id: flaggedUserId,
        flagger_id: flaggerId,
        community_id: communityId,
        reason: reason,
        severity: severity || 'moderate'
      }])
      .select()
      .single();

    if (flagError) throw flagError;

    // 4. Run abuse pattern detection
    await supabase.rpc('detect_abuse_patterns');

    return res.status(200).json({ success: true, flag });

  } catch (error) {
    console.error('Flag user error:', error);
    return res.status(500).json({ error: error.message });
  }
}
