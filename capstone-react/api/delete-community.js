import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { id, userId } = req.query;
  if (!id) return res.status(400).json({ message: 'Community ID required.' });
  if (!userId) return res.status(400).json({ message: 'User ID required.' });

  // Fetch the community to check ownership
  const { data: community, error: fetchError } = await supabaseAdmin
    .from('communities').select('id, creator_id').eq('id', id).single();

  if (fetchError || !community) return res.status(404).json({ message: 'Circle not found.' });

  // Allow if requester is the creator or an admin
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('user_type').eq('id', userId).single();

  const isAdmin = profile?.user_type === 'Admin';
  const isCreator = community.creator_id === userId;

  if (!isCreator && !isAdmin) {
    return res.status(403).json({ message: 'Only the circle creator or an admin can delete this circle.' });
  }

  // Delete opportunities first (no ON DELETE CASCADE on this FK)
  const { error: oppError } = await supabaseAdmin.from('opportunities').delete().eq('community_id', id);
  if (oppError) console.error('[DELETE COMMUNITY] opportunities error:', JSON.stringify(oppError));

  // Delete memberships (FK constraint not cascading in live DB)
  const { error: memError } = await supabaseAdmin.from('memberships').delete().eq('community_id', id);
  if (memError) console.error('[DELETE COMMUNITY] memberships error:', JSON.stringify(memError));

  // Delete the community (all other related tables cascade)
  const { error: deleteError } = await supabaseAdmin
    .from('communities').delete().eq('id', id);

  if (deleteError) {
    console.error('[DELETE COMMUNITY]', JSON.stringify(deleteError));
    return res.status(500).json({ message: deleteError.message, detail: deleteError.details, hint: deleteError.hint, code: deleteError.code });
  }

  return res.status(200).json({ message: 'Circle deleted successfully.' });
}
