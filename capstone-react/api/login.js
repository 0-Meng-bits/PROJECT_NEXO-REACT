import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { studentId, password } = req.body;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('*').eq('student_id', studentId).single();

  if (profileError || !profile) {
    return res.status(401).json({ message: 'CTU_ID not found in the system.' });
  }

  const isPending = !profile.is_verified;

  // Try Supabase Auth first
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (authError) {
    // Legacy fallback — check stored password
    const passwordOk = !profile.password || profile.password === password;
    if (!passwordOk) return res.status(401).json({ message: 'Invalid credentials.' });

    return res.json({
      message: isPending ? 'Pending approval' : 'Authentication successful',
      user: profile,
      session: null,
      pending: isPending,
      legacy: true,
    });
  }

  res.json({
    message: isPending ? 'Pending approval' : 'Authentication successful',
    user: profile,
    session: authData.session,
    pending: isPending,
  });
}
