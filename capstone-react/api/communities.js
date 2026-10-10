import { supabaseAdmin } from './_supabase.js';
import { insertNotification } from './_notifications.js';

export default async function handler(req, res) {
  // GET — fetch all communities
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('communities')
      .select('*, accounts!creator_id(full_name)')
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ message: error.message });
    return res.json(data);
  }

  // POST — submit a circle creation request (requires admin approval)
  if (req.method === 'POST') {
    let resolvedUserId = null;

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) resolvedUserId = user.id;
    }
    if (!resolvedUserId) {
      const legacyUserId = req.headers['x-user-id'];
      if (legacyUserId) {
        const { data: profile } = await supabaseAdmin
          .from('accounts').select('id').eq('id', legacyUserId).single();
        if (profile) resolvedUserId = profile.id;
      }
    }
    if (!resolvedUserId) return res.status(401).json({ message: 'Unable to verify identity.' });

    const { name, description, category, icon, interest_tag, is_open, invitees } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Circle name is required.' });

    // Insert into circle_requests for admin approval (existing flow)
    const { data, error } = await supabaseAdmin
      .from('circle_requests')
      .insert([{
        name: name.trim(),
        description: description?.trim() || '',
        category,
        icon,
        creator_id: resolvedUserId,
        status: 'pending',
        interest_tag: interest_tag || null,
        is_open: is_open || false,
        invitees: invitees || [],
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    // Notify invited connections about the pending circle invite
    const inviteeList = Array.isArray(invitees) ? invitees : [];
    if (inviteeList.length > 0) {
      const { data: creator } = await supabaseAdmin
        .from('accounts').select('full_name').eq('id', resolvedUserId).single();
      for (const inviteeId of inviteeList) {
        await insertNotification({
          userId: inviteeId,
          type: 'circle_invite',
          message: `${creator?.full_name || 'Someone'} invited you to join the circle "${name.trim()}". It's pending admin approval.`,
          groupKey: null,
          category: 'Circles',
        });
      }
    }

    return res.json({ request: data, pending: true });
  }

  res.status(405).end();
}
