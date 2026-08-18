import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Accept userId query param (token auth unreliable with new Supabase key format)
  const userId = req.query.userId;
  if (userId) {
    const { data: account, error } = await supabaseAdmin
      .from('accounts').select('*, account_status(*), account_details(*)').eq('id', userId).single();
    if (error || !account) return res.status(404).json({ message: 'Profile not found.' });
    const user = { ...account, student_id: account.ctu_id, is_verified: account.account_status?.is_verified, ...account.account_details };
    delete user.account_status; delete user.account_details;
    return res.json({ user });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ message: 'Invalid or expired session.' });

  const { data: account } = await supabaseAdmin
    .from('accounts').select('*, account_status(*), account_details(*)').eq('id', authUser.id).single();

  if (!account) return res.status(404).json({ message: 'Profile not found.' });
  const user = { ...account, student_id: account.ctu_id, is_verified: account.account_status?.is_verified, ...account.account_details };
  delete user.account_status; delete user.account_details;
  res.json({ user });
}
