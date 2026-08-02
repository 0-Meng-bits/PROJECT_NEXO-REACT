import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ message: 'Missing userId.' });

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId);

  if (error) return res.status(500).json({ message: error.message });
  res.json({ ok: true });
}
