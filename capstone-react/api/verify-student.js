import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'Missing student id.' });

  await supabaseAdmin.from('account_status').update({ is_verified: true }).eq('id', id);

  if (error) return res.status(400).json(error);
  res.json({ message: 'Student verified!' });
}
