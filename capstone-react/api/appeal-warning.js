import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, warningId, appealReason, evidence } = req.body;

  if (!userId || !warningId || !appealReason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Verify warning exists and belongs to user
    const { data: warning } = await supabase
      .from('user_warnings')
      .select('*')
      .eq('id', warningId)
      .eq('user_id', userId)
      .single();

    if (!warning) {
      return res.status(404).json({ error: 'Warning not found' });
    }

    // 2. Check if already appealed
    const { data: existingAppeal } = await supabase
      .from('warning_appeals')
      .select('id')
      .eq('warning_id', warningId)
      .single();

    if (existingAppeal) {
      return res.status(400).json({ error: 'Warning already appealed' });
    }

    // 3. Create appeal
    const { data: appeal, error: appealError } = await supabase
      .from('warning_appeals')
      .insert([{
        warning_id: warningId,
        user_id: userId,
        appeal_reason: appealReason,
        evidence: evidence || null
      }])
      .select()
      .single();

    if (appealError) throw appealError;

    // 4. Update warning status
    await supabase
      .from('user_warnings')
      .update({ status: 'appealed' })
      .eq('id', warningId);

    return res.status(200).json({ success: true, appeal });

  } catch (error) {
    console.error('Appeal warning error:', error);
    return res.status(500).json({ error: error.message });
  }
}
