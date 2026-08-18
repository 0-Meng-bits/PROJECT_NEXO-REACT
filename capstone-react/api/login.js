import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { studentId, password } = req.body;

  const { data: account, error } = await supabaseAdmin
    .from('accounts')
    .select('*, account_status(*), account_details(*)')
    .eq('ctu_id', studentId)
    .single();

  if (error || !account) {
    return res.status(401).json({ message: 'CTU_ID not found in the system.' });
  }

  const status = account.account_status || {};
  const details = account.account_details || {};

  if (status.is_banned) {
    return res.status(403).json({ message: 'Your account has been banned.', banned: true });
  }

  if (status.suspended_until && new Date(status.suspended_until) > new Date()) {
    return res.status(403).json({
      message: `Your account is suspended until ${new Date(status.suspended_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
      suspended: true,
      suspended_until: status.suspended_until,
    });
  }

  const isPending = !status.is_verified;

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (authError) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const user = {
    ...account,
    student_id: account.ctu_id,
    is_verified: status.is_verified,
    is_banned: status.is_banned,
    suspended_until: status.suspended_until,
    warning_count: status.warning_count,
    trust_points: status.trust_points,
    ...details,
  };
  delete user.account_status;
  delete user.account_details;

  res.json({
    message: isPending ? 'Pending approval' : 'Authentication successful',
    user,
    session: authData.session,
    pending: isPending,
  });
}
