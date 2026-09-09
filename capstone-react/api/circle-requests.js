import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  // GET - Fetch all circle requests
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('circle_requests')
      .select('*, creator:creator_id(full_name, ctu_id)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FETCH CIRCLE REQUESTS]', error);
      return res.status(500).json({ message: 'Failed to fetch circle requests.' });
    }

    return res.json(data || []);
  }

  // POST - Approve or reject
  if (req.method !== 'POST') return res.status(405).end();

  const { action } = req.query; // approve or reject
  const { requestId, adminId, note } = req.body;

  console.log('[CIRCLE REQUEST]', { action, requestId, adminId, note });

  if (!requestId) {
    return res.status(400).json({ message: 'Missing requestId.' });
  }

  if (!adminId) {
    return res.status(400).json({ message: 'Missing adminId.' });
  }

  // Get the circle request
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('circle_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return res.status(404).json({ message: 'Circle request not found.' });
  }

  if (action === 'approve') {
    // 1. Create the community
    const { data: newCommunity, error: createError } = await supabaseAdmin
      .from('communities')
      .insert([{
        name: request.name,
        description: request.description,
        category: request.category,
        icon: request.icon,
        creator_id: request.creator_id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('[APPROVE CIRCLE]', createError);
      return res.status(500).json({ message: 'Failed to create circle.' });
    }

    // 2. Add creator as a member with leader rank
    const { error: memberError } = await supabaseAdmin
      .from('memberships')
      .insert([{
        user_id: request.creator_id,
        community_id: newCommunity.id,
        rank_level: 2, // Leader rank
        status: 'active'
      }]);

    if (memberError) {
      console.error('[ADD LEADER AS MEMBER]', memberError);
      // Don't fail the whole operation, just log it
    }

    // 3. Create default channels
    const defaultChannels = [
      { name: 'announcements', description: 'Official announcements', channel_type: 'chat' },
      { name: 'general', description: 'General discussion', channel_type: 'chat' }
    ];

    for (const channel of defaultChannels) {
      await supabaseAdmin.from('channels').insert([{
        community_id: newCommunity.id,
        name: channel.name,
        description: channel.description,
        channel_type: channel.channel_type
      }]);
    }

    // 4. Update request status
    await supabaseAdmin
      .from('circle_requests')
      .update({ 
        status: 'approved', 
        reviewed_by: adminId, 
        reviewed_at: new Date().toISOString() 
      })
      .eq('id', requestId);

    // 5. Notify the creator
    await supabaseAdmin.from('notifications').insert([{
      user_id: request.creator_id,
      title: 'Circle Approved',
      message: `Your circle "${request.name}" has been approved! You can now invite members.`,
      type: 'circle_approved',
      reference_id: newCommunity.id
    }]);

    return res.json({ 
      message: 'Circle approved successfully.', 
      community: newCommunity 
    });

  } else if (action === 'reject') {
    // Update request status
    await supabaseAdmin
      .from('circle_requests')
      .update({ 
        status: 'rejected', 
        reviewed_by: adminId, 
        reviewed_at: new Date().toISOString(),
        admin_note: note 
      })
      .eq('id', requestId);

    // Notify the creator
    await supabaseAdmin.from('notifications').insert([{
      user_id: request.creator_id,
      title: 'Circle Request Rejected',
      message: `Your circle request "${request.name}" was not approved.${note ? ` Reason: ${note}` : ''}`,
      type: 'circle_rejected'
    }]);

    return res.json({ message: 'Circle request rejected.' });

  } else {
    return res.status(400).json({ message: 'Invalid action.' });
  }
}
