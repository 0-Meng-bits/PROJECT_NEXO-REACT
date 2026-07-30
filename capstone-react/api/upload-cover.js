import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const communityId = req.body.communityId || req.query.communityId;
  if (!communityId) return res.status(400).json({ message: 'Missing communityId.' });

  // Build the update object
  const updates = {};
  if (req.body.cover !== undefined)       updates.cover_url   = req.body.cover;
  if (req.body.cover_url !== undefined)   updates.cover_url   = req.body.cover_url;
  if (req.body.logo_url !== undefined)    updates.logo_url    = req.body.logo_url;
  if (req.body.name !== undefined)        updates.name        = req.body.name;
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.category !== undefined)    updates.category    = req.body.category;

  if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'Nothing to update.' });

  const { error } = await supabaseAdmin
    .from('communities').update(updates).eq('id', communityId);

  if (error) {
    console.error('[upload-cover] DB error:', error);
    return res.status(500).json({ message: 'Failed to save: ' + error.message });
  }

  res.json({ ok: true });
}
