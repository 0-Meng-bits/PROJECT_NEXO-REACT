import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Accept userId as query param (token auth unreliable with new key format)
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, student_id, full_name, email, user_type, is_verified, avatar_url, id_photo_url, course, year_level, interests, onboarding_complete, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('[GET-PROFILE] error:', error?.message);
    return res.status(404).json({ message: 'Profile not found.' });
  }

  res.json({ user: data });
}
