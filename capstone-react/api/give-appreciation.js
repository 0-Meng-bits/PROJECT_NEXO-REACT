import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { giverId, receiverId, amount, reason, communityId } = req.body;

  if (!giverId || !receiverId || !amount || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Check if giver can give appreciation (cooldown)
    const { data: canGive } = await supabase
      .rpc('can_give_appreciation', { p_giver_id: giverId, p_receiver_id: receiverId });

    if (!canGive) {
      return res.status(400).json({ error: 'Cooldown active or invalid recipient' });
    }

    // 2. Get giver's rank to validate amount
    const { data: membership } = await supabase
      .from('memberships')
      .select('rank_level')
      .eq('user_id', giverId)
      .eq('community_id', communityId)
      .single();

    const maxAmount = (membership?.rank_level >= 2) ? 0.5 : 0.3;
    if (amount > maxAmount) {
      return res.status(400).json({ error: `You can only give up to ${maxAmount} points` });
    }

    // 3. Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayGiven, error: countError } = await supabase
      .from('appreciation_cooldowns')
      .select('receiver_id')
      .eq('giver_id', giverId)
      .gte('given_at', today.toISOString());

    if (countError) throw countError;

    const maxRecipients = (membership?.rank_level >= 2) ? 5 : 3;
    if (todayGiven && todayGiven.length >= maxRecipients) {
      return res.status(400).json({ error: `Daily limit reached (${maxRecipients} recipients)` });
    }

    // 4. Create point transaction
    const { data: transaction, error: txError } = await supabase
      .from('point_transactions')
      .insert([{
        user_id: receiverId,
        amount: amount,
        transaction_type: 'appreciation',
        from_user_id: giverId,
        community_id: communityId,
        reason: reason
      }])
      .select()
      .single();

    if (txError) throw txError;

    // 5. Record cooldown
    const { error: cooldownError } = await supabase
      .from('appreciation_cooldowns')
      .insert([{
        giver_id: giverId,
        receiver_id: receiverId
      }]);

    if (cooldownError) throw cooldownError;

    // 6. Update receiver's trust_points in account_status
    const { data: currentPoints } = await supabase
      .rpc('get_user_trust_points', { target_user_id: receiverId });

    await supabase
      .from('account_status')
      .update({ trust_points: currentPoints })
      .eq('id', receiverId);

    return res.status(200).json({ 
      success: true, 
      newPoints: currentPoints,
      transaction 
    });

  } catch (error) {
    console.error('Give appreciation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
