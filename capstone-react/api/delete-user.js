import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { id: targetId, adminId } = req.query;
  if (!targetId) return res.status(400).json({ message: 'User ID required.' });
  if (!adminId)  return res.status(400).json({ message: 'Admin ID required.' });

  // Verify requester is an admin
  const { data: adminProfile } = await supabaseAdmin
    .from('profiles').select('user_type').eq('id', adminId).single();
  if (!adminProfile || adminProfile.user_type !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  // Manually delete related rows that may not have ON DELETE CASCADE in live DB
  await supabaseAdmin.from('memberships').delete().eq('user_id', targetId);
  await supabaseAdmin.from('notifications').delete().eq('user_id', targetId);
  await supabaseAdmin.from('announcements').delete().eq('author_id', targetId);
  await supabaseAdmin.from('audition_responses').delete().eq('applicant_id', targetId);
  await supabaseAdmin.from('messages').delete().eq('student_id',
    (await supabaseAdmin.from('profiles').select('student_id').eq('id', targetId).single()).data?.student_id
  );

  // Delete profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles').delete().eq('id', targetId);
  if (profileError) {
    console.error('[DELETE USER] Profile error:', profileError.message, profileError.details);
    return res.status(500).json({ message: profileError.message, detail: profileError.details, hint: profileError.hint });
  }

  // Delete from Supabase Auth
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (authDeleteError) {
    console.error('[DELETE USER] Auth error:', authDeleteError.message);
    return res.status(207).json({ message: 'Profile deleted but auth user removal failed.' });
  }

  return res.status(200).json({ message: 'User deleted successfully.' });
}
