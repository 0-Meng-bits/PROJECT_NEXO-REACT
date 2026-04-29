import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabaseAdmin
    .from('profiles').select('*').order('created_at', { ascending: false });

  if (error) return res.status(400).json(error);
  res.json(data);
}
