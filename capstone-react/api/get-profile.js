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
    if (legacyId) {
      const { data } = await supabaseAdmin
        .from('profiles').select('id').eq('id', legacyId).single();
      if (data) resolvedUserId = data.id;
    }
  }

  if (!resolvedUserId) return res.status(401).json({ message: 'Unauthorized.' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', resolvedUserId)
    .single();

  if (error || !data) return res.status(404).json({ message: 'Profile not found.' });

  res.json({ user: data });
}
