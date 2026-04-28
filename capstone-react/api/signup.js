import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, fullName, studentId, user_type } = req.body;

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) return res.status(400).json({ message: authError.message });

  // Insert profile
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert([{
      id: authData.user.id,
      student_id: studentId,
      full_name: fullName,
      email,
      user_type,
      is_verified: false,
    }])
    .select().single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ message: error.message });
  }

  // Sign in to get session
  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });

  res.status(200).json({
    message: 'Awaiting approval',
    user: data,
    session: sessionData?.session || null,
  });
}
