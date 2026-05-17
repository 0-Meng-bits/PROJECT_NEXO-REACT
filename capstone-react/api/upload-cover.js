import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let resolvedUserId = req.query.userId || null;

  if (!resolvedUserId) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && user) resolvedUserId = user.id;
    }
  }
  if (!resolvedUserId) {
    resolvedUserId = req.headers['x-user-id'] || null;
  }
  if (!resolvedUserId) return res.status(401).json({ message: 'Unable to verify identity.' });

  const { cover, communityId } = req.body;
  if (!cover || !communityId) return res.status(400).json({ message: 'Missing cover or communityId.' });

  // Confirm requester is the creator
  const { data: comm, error: commErr } = await supabaseAdmin
    .from('communities').select('creator_id').eq('id', communityId).single();
  if (commErr || !comm) return res.status(404).json({ message: 'Circle not found.' });
  if (comm.creator_id !== resolvedUserId) {
    return res.status(403).json({ message: 'Only the circle creator can change the cover photo.' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('communities').update({ cover_url: cover }).eq('id', communityId);

  if (updateError) return res.status(500).json({ message: 'Failed to save cover photo.' });

  res.json({ url: cover });
}
