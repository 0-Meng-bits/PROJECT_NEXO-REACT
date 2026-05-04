import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  let resolvedUserId = null;

  // Try JWT token first
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) resolvedUserId = user.id;
  }

  // Fallback: x-user-id header for legacy accounts
  if (!resolvedUserId) {
    const legacyId = req.headers['x-user-id'];
    if (legacyId) resolvedUserId = legacyId;
  }

  if (!resolvedUserId) return res.status(401).json({ message: 'Unauthorized.' });

  // Use admin client to bypass RLS
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, student_id, full_name, email, user_type, is_verified, avatar_url, id_photo_url, course, year_level, interests, onboarding_complete, created_at')
    .eq('id', resolvedUserId)
    .single();

  if (error || !data) {
    console.error('[GET-PROFILE] error:', error?.message);
    return res.status(404).json({ message: 'Profile not found.' });
  }

  res.json({ user: data });
}
