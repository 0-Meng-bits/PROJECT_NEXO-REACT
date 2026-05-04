import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ message: 'Invalid session.' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'Community ID required.' });

  // Fetch the community to check ownership
  const { data: community, error: fetchError } = await supabaseAdmin
    .from('communities').select('id, owner_id').eq('id', id).single();

  if (fetchError || !community) return res.status(404).json({ message: 'Circle not found.' });

  // Allow if requester is the owner or an admin
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('user_type').eq('id', user.id).single();

  const isAdmin = profile?.user_type === 'Admin';
  const isOwner = community.owner_id === user.id;

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: 'Only the circle owner or an admin can delete this circle.' });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('communities').delete().eq('id', id);

  if (deleteError) {
    console.error('[DELETE COMMUNITY]', deleteError.message);
    return res.status(500).json({ message: 'Failed to delete circle.', detail: deleteError.message });
  }

  return res.status(200).json({ message: 'Circle deleted successfully.' });
}
