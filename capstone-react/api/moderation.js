import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    // ── GIVE APPRECIATION ───────────────────────────────────────────────
    if (action === 'give-appreciation') {
      const { giverId, receiverId, amount, reason, communityId } = req.body;

      if (!giverId || !receiverId || !amount || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate amount
      if (amount <= 0 || amount > 0.5) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Check cooldown
      const { data: cooldownData } = await supabaseAdmin.rpc('can_give_appreciation', {
        p_giver_id: giverId,
        p_receiver_id: receiverId
      });

      if (!cooldownData) {
        return res.status(400).json({ error: 'Cooldown active. Wait 12 hours before giving to this person again.' });
      }

      // Get giver's rank to check daily limits
      let maxRecipients = 3;
      if (communityId) {
        const { data: membership } = await supabaseAdmin
          .from('memberships')
          .select('rank_level')
          .eq('user_id', giverId)
          .eq('community_id', communityId)
          .single();
        if (membership && membership.rank_level >= 2) maxRecipients = 5;
      }

      // Check daily limit
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabaseAdmin
        .from('appreciation_cooldowns')
        .select('*', { count: 'exact', head: true })
        .eq('giver_id', giverId)
        .gte('given_at', today);

      if (count >= maxRecipients) {
        return res.status(400).json({ error: `Daily limit reached (${maxRecipients} recipients)` });
      }

      // Insert point transaction
      const { error: txError } = await supabaseAdmin.from('point_transactions').insert([{
        user_id: receiverId,
        amount: amount,
        transaction_type: 'appreciation',
        from_user_id: giverId,
        community_id: communityId,
        reason: reason
      }]);

      if (txError) return res.status(400).json({ error: txError.message });

      // Record cooldown
      await supabaseAdmin.from('appreciation_cooldowns').insert([{
        giver_id: giverId,
        receiver_id: receiverId,
        given_at: new Date().toISOString()
      }]);

      // Send notification
      await supabaseAdmin.from('notifications').insert([{
        user_id: receiverId,
        type: 'join_approved',
        message: `You received +${amount} trust points! Reason: ${reason}`
      }]);

      return res.json({ success: true });
    }

    // ── FLAG USER ───────────────────────────────────────────────────────
    if (action === 'flag-user') {
      const { flaggerId, flaggedUserId, communityId, reason, severity } = req.body;

      if (!flaggerId || !flaggedUserId || !reason || !severity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if already flagged this user recently (prevent spam)
      const { data: recentFlags } = await supabaseAdmin
        .from('user_flags')
        .select('id')
        .eq('flagger_id', flaggerId)
        .eq('flagged_user_id', flaggedUserId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (recentFlags && recentFlags.length > 0) {
        return res.status(400).json({ error: 'You already flagged this user in the last 24 hours' });
      }

      // Create flag
      const { error: flagError } = await supabaseAdmin.from('user_flags').insert([{
        flagger_id: flaggerId,
        flagged_user_id: flaggedUserId,
        community_id: communityId,
        reason: reason,
        severity: severity,
        status: 'pending'
      }]);

      if (flagError) return res.status(400).json({ error: flagError.message });

      // Run abuse pattern detection
      await supabaseAdmin.rpc('detect_abuse_patterns');

      return res.json({ success: true });
    }

    // ── APPEAL WARNING ──────────────────────────────────────────────────
    if (action === 'appeal-warning') {
      const { warningId, userId, appealReason, evidence } = req.body;

      if (!warningId || !userId || !appealReason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if warning exists and belongs to user
      const { data: warning } = await supabaseAdmin
        .from('user_warnings')
        .select('*')
        .eq('id', warningId)
        .eq('user_id', userId)
        .single();

      if (!warning) {
        return res.status(404).json({ error: 'Warning not found' });
      }

      if (warning.status !== 'active') {
        return res.status(400).json({ error: 'Can only appeal active warnings' });
      }

      // Check if already appealed
      const { data: existingAppeal } = await supabaseAdmin
        .from('warning_appeals')
        .select('id')
        .eq('warning_id', warningId)
        .single();

      if (existingAppeal) {
        return res.status(400).json({ error: 'You have already appealed this warning' });
      }

      // Create appeal
      const { error: appealError } = await supabaseAdmin.from('warning_appeals').insert([{
        warning_id: warningId,
        user_id: userId,
        appeal_reason: appealReason,
        evidence: evidence,
        status: 'pending'
      }]);

      if (appealError) return res.status(400).json({ error: appealError.message });

      // Update warning status
      await supabaseAdmin.from('user_warnings')
        .update({ status: 'appealed', appeal_reason: appealReason })
        .eq('id', warningId);

      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Moderation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
