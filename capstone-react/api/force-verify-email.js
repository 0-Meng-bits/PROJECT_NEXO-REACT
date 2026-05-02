import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Extract id from URL path
  const id = req.query.id || req.url.split('/').pop();
  if (!id) return res.status(400).json({ message: 'User ID required.' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    email_confirm: true,
  });

  if (error) return res.status(400).json({ message: error.message });
  res.json({ message: 'Email confirmed.' });
}
