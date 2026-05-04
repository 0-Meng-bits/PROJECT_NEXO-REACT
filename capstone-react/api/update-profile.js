import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Resolve user from JWT token
  let resolvedUserId = null;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) resolvedUserId = user.id;
  }
  // Fallback for legacy accounts
  if (!resolvedUserId) {
    const legacyId = req.headers['x-user-id'];
    if (legacyId) {
      const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', legacyId).single();
      if (data) resolvedUserId = data.id;
    }
  }
  if (!resolvedUserId) return res.status(401).json({ message: 'Unauthorized.' });

  const { course, year_level, interests } = req.body;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ course, year_level, interests })
    .eq('id', resolvedUserId);

  if (error) {
    console.error('[UPDATE PROFILE]', error.message);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }

  res.json({ message: 'Profile updated.' });
}
