import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const { course, year_level, interests } = req.body;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ course, year_level, interests })
    .eq('id', userId);

  if (error) {
    console.error('[UPDATE PROFILE]', error.message);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }

  res.json({ message: 'Profile updated.' });
}
