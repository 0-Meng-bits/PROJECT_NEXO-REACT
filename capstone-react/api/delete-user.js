import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  // Verify the requester is an admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ message: 'Invalid session.' });

  const { data: adminProfile } = await supabaseAdmin
    .from('profiles').select('user_type').eq('id', user.id).single();
  if (!adminProfile || adminProfile.user_type !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  // Vercel routes /api/delete-user/[id] — extract id from URL
  const parts = req.url.split('/');
  const targetId = parts[parts.length - 1];
  if (!targetId) return res.status(400).json({ message: 'User ID required.' });

  // Delete profile first (cascades related data via FK)
  const { error: profileError } = await supabaseAdmin
    .from('profiles').delete().eq('id', targetId);
  if (profileError) {
    console.error('[DELETE USER] Profile delete error:', profileError.message);
    return res.status(500).json({ message: 'Failed to delete profile.', detail: profileError.message });
  }

  // Delete from Supabase Auth
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (authDeleteError) {
    console.error('[DELETE USER] Auth delete error:', authDeleteError.message);
    return res.status(207).json({ message: 'Profile deleted but auth user removal failed.' });
  }

  return res.status(200).json({ message: 'User deleted successfully.' });
}
