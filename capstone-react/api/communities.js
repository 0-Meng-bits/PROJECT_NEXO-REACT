import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  // GET — fetch all communities
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ message: error.message });
    return res.json(data);
  }

  // POST — create a community
  if (req.method === 'POST') {
    let resolvedUserId = null;

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) resolvedUserId = user.id;
    }
    if (!resolvedUserId) {
      const legacyUserId = req.headers['x-user-id'];
      if (legacyUserId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles').select('id').eq('id', legacyUserId).single();
        if (profile) resolvedUserId = profile.id;
      }
    }
    if (!resolvedUserId) return res.status(401).json({ message: 'Unable to verify identity.' });

    const { name, description, category, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Circle name is required.' });

    const { data, error } = await supabaseAdmin
      .from('communities')
      .insert([{ name: name.trim(), description: description?.trim() || '', category, icon, creator_id: resolvedUserId, is_official: false }])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ community: data });
  }

  res.status(405).end();
}
