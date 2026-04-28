import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ message: 'Invalid or expired session.' });

  const { data } = await supabaseAdmin
    .from('profiles').select('*').eq('id', user.id).single();

  if (!data) return res.status(404).json({ message: 'Profile not found.' });
  res.json({ user: data });
}
