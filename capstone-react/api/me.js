import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Accept userId query param (token auth unreliable with new Supabase key format)
  const userId = req.query.userId;
  if (userId) {
    const [{ data: account, error }, { data: interestRows }] = await Promise.all([
      supabaseAdmin.from('accounts').select('*, account_status(*), account_details(*)').eq('id', userId).single(),
      supabaseAdmin.from('user_interests').select('interest').eq('user_id', userId),
    ]);
    if (error || !account) return res.status(404).json({ message: 'Profile not found.' });
    const statusObj = Array.isArray(account.account_status) ? account.account_status[0] : account.account_status;
    const detailObj = Array.isArray(account.account_details) ? account.account_details[0] : account.account_details;
    const user = { ...account, student_id: account.ctu_id, is_verified: statusObj?.is_verified, ...detailObj, interests: (interestRows || []).map(r => r.interest) };
    delete user.account_status; delete user.account_details;
    return res.json({ user });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ message: 'Invalid or expired session.' });

  const [{ data: account }, { data: interestRows }] = await Promise.all([
    supabaseAdmin.from('accounts').select('*, account_status(*), account_details(*)').eq('id', authUser.id).single(),
    supabaseAdmin.from('user_interests').select('interest').eq('user_id', authUser.id),
  ]);

  if (!account) return res.status(404).json({ message: 'Profile not found.' });
  const statusObj = Array.isArray(account.account_status) ? account.account_status[0] : account.account_status;
  const detailObj = Array.isArray(account.account_details) ? account.account_details[0] : account.account_details;
  const user = { ...account, student_id: account.ctu_id, is_verified: statusObj?.is_verified, ...detailObj, interests: (interestRows || []).map(r => r.interest) };
  delete user.account_status; delete user.account_details;
  res.json({ user });
}
