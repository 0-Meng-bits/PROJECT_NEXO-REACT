import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'Missing student id.' });

  // Get current status to avoid double-granting
  const { data: current } = await supabaseAdmin
    .from('account_status')
    .select('is_verified, trust_points')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('account_status')
    .update({ is_verified: true })
    .eq('id', id);

  if (error) return res.status(400).json(error);

  // Grant 50 TP welcome bonus if not already verified
  if (!current?.is_verified) {
    const currentPoints = current?.trust_points ?? 0;
    await supabaseAdmin
      .from('account_status')
      .update({ trust_points: currentPoints + 50 })
      .eq('id', id);

    try {
      await supabaseAdmin.from('point_transactions').insert([{
        user_id: id,
        amount: 50,
        transaction_type: 'welcome_bonus',
        reason: 'Welcome bonus for verified student',
      }]);
    } catch { /* non-fatal */ }
  }

  res.json({ message: 'Student verified!' });
}
