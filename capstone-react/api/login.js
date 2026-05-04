import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { studentId, password } = req.body;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('*').eq('student_id', studentId).single();

  if (profileError || !profile) {
    return res.status(401).json({ message: 'CTU_ID not found in the system.' });
  }

  // Check ban
  if (profile.is_banned) {
    return res.status(403).json({ message: 'Your account has been banned.', banned: true });
  }

  // Check suspension
  if (profile.suspended_until && new Date(profile.suspended_until) > new Date()) {
    return res.status(403).json({
      message: `Your account is suspended until ${new Date(profile.suspended_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
      suspended: true,
      suspended_until: profile.suspended_until,
    });
  }

  const isPending = !profile.is_verified;

  // Try Supabase Auth first
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (authError) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  res.json({
    message: isPending ? 'Pending approval' : 'Authentication successful',
    user: profile,
    session: authData.session,
    pending: isPending,
  });
}
