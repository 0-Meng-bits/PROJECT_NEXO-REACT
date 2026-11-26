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
    // If logo_url is base64, upload to storage first
    let finalLogoUrl = request.logo_url || null;
    if (finalLogoUrl && finalLogoUrl.startsWith('data:')) {
      const matches = finalLogoUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const storagePath = `communities/pending-${requestId}/logo.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('avatars')
          .upload(storagePath, buffer, { contentType: `image/${matches[1]}`, upsert: true });
        if (!upErr) {
          const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(storagePath);
          finalLogoUrl = urlData.publicUrl;
        }
      }
    }

    // 1. Create the community as pending (needs 3 members to activate)
    const { data: newCommunity, error: createError } = await supabaseAdmin
      .from('communities')
      .insert([{
        name: request.name,
        description: request.description,
        category: request.category,
        icon: request.icon,
        creator_id: request.creator_id,
        is_open: request.is_open || false,
        logo_url: finalLogoUrl,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('[APPROVE CIRCLE]', createError);
      return res.status(500).json({ message: 'Failed to create circle.' });
    }

    // 1b. Insert normalized community_interests rows if request had interest_tag(s)
    const requestTags = request.interest_tag
      ? String(request.interest_tag).split(',').map(t => t.trim()).filter(Boolean)
      : [];
    if (requestTags.length > 0) {
      await supabaseAdmin.from('community_interests').insert(
        [...new Set(requestTags)].map(interest => ({ community_id: newCommunity.id, interest }))
      );
    }

    // 2. Add creator as a member with Leader rank (rank_level 3)
    const { error: memberError } = await supabaseAdmin
      .from('memberships')
      .insert([{
        user_id: request.creator_id,
        community_id: newCommunity.id,
        rank_level: 3,
        status: 'active'
      }]);

    if (memberError) {
      console.error('[ADD LEADER AS MEMBER]', memberError);
    }

    // 3. Create default channels
    const defaultChannels = [
      { name: 'announcements', description: 'Official announcements', channel_type: 'chat' },
      { name: 'general', description: 'General discussion', channel_type: 'chat' },
      { name: 'voice', description: 'Voice & video calls', channel_type: 'voice' },
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
      type: 'circle_approved',
      message: `Your circle "${request.name}" has been approved! You can now invite members.`,
      category: 'Circles',
      link_comm_id: newCommunity.id,
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
      type: 'circle_rejected',
      message: `Your circle request "${request.name}" was not approved.${note ? ` Reason: ${note}` : ' No reason was provided.'}`,
      category: 'Circles',
    }]);

    return res.json({ message: 'Circle request rejected.' });

  } else if (action === 'delete') {
    // Admin-only: delete a circle request record (approved/rejected entries only)
    const { error } = await supabaseAdmin
      .from('circle_requests')
      .delete()
      .eq('id', requestId);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ message: 'Record deleted.' });

  } else {
    return res.status(400).json({ message: 'Invalid action.' });
  }
}
