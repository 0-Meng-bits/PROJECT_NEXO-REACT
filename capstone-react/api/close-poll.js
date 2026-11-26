import { supabase, supabaseAdmin } from './_supabase.js';

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function validateEventMetadata(metadata) {
  if (!metadata.event_date) throw new Error('Event date is required');
  if (!metadata.event_time) throw new Error('Event time is required');
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(metadata.event_time)) throw new Error('Event time must be in HH:MM format (24-hour)');
  if (!metadata.location || metadata.location.trim() === '') throw new Error('Location is required');
  if (metadata.location.length > 200) throw new Error('Location cannot exceed 200 characters');
}

function convertTimeToSQL(timeString) {
  return `${timeString}:00`;
}

function determineWinner(pollOptions, pollVotes) {
  if (!pollOptions || pollOptions.length === 0) throw new Error('Poll has no options');
  const voteCounts = {};
  pollOptions.forEach(option => { voteCounts[option] = (pollVotes[option] || []).length; });
  const maxVotes = Math.max(...Object.values(voteCounts));
  if (maxVotes === 0) return pollOptions[0];
  for (const option of pollOptions) {
    if (voteCounts[option] === maxVotes) return option;
  }
  return pollOptions[0];
}

async function notifyVoters(voterIds, pollTitle, eventTitle, eventId, communityId) {
  const notifications = [...voterIds].map(voterId => ({
    user_id: voterId,
    type: 'event_from_poll',
    message: `The poll '${pollTitle}' has closed! Event created: ${eventTitle}`,
    link_comm_id: communityId,
    is_read: false
  }));
  if (notifications.length > 0) {
    await supabaseAdmin.from('notifications').insert(notifications);
  }
}

// ── MAIN API HANDLER ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' });
  }

  try {
    // 0. Verify auth
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No authorization header' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid auth token' });
    const closerId = user.id;

    const { announcementId, communityId } = req.body;
    if (!announcementId || !communityId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'announcementId and communityId required' });
    }

    // 1. Authorization check
    const { data: membership, error: memberError } = await supabase
      .from('memberships')
      .select('rank_level')
      .eq('user_id', closerId)
      .eq('community_id', communityId)
      .in('status', ['active', 'approved'])
      .single();

    if (memberError || !membership || membership.rank_level <= 0) {
      const { data: comm } = await supabase.from('communities').select('creator_id').eq('id', communityId).single();
      if (!comm || comm.creator_id !== closerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Only community leaders can close polls' });
      }
    }

    // 2. Fetch announcement
    const { data: poll, error: pollError } = await supabase
      .from('announcements')
      .select('id, title, post_type, author_id, community_id')
      .eq('id', announcementId)
      .single();

    if (pollError || !poll) return res.status(404).json({ error: 'NOT_FOUND', message: 'Poll not found' });
    if (poll.post_type !== 'poll') return res.status(400).json({ error: 'INVALID_TYPE', message: 'This announcement is not a poll' });

    // 3. Fetch poll options from poll_options table
    const { data: optionRows } = await supabaseAdmin
      .from('poll_options')
      .select('id, option_text, display_order')
      .eq('announcement_id', announcementId)
      .order('display_order', { ascending: true });

    const pollOptions = (optionRows || []).map(r => r.option_text);

    // 4. Fetch votes from poll_votes table
    const { data: voteRows } = await supabaseAdmin
      .from('poll_votes')
      .select('option_id, voter_id')
      .eq('announcement_id', announcementId);

    // Build optionId → option_text map
    const optionIdToText = {};
    (optionRows || []).forEach(r => { optionIdToText[r.id] = r.option_text; });

    // Build pollVotes as { option_text: [voter_ids] } for determineWinner compatibility
    const pollVotes = {};
    pollOptions.forEach(opt => { pollVotes[opt] = []; });
    (voteRows || []).forEach(v => {
      const text = optionIdToText[v.option_id];
      if (text) { if (!pollVotes[text]) pollVotes[text] = []; pollVotes[text].push(v.voter_id); }
    });

    // 5. Fetch announcement_events row
    const { data: eventMeta } = await supabaseAdmin
      .from('announcement_events')
      .select('*')
      .eq('announcement_id', announcementId)
      .maybeSingle();

    // 6. Check if already closed
    if (eventMeta?.is_closed) {
      return res.status(409).json({ error: 'ALREADY_CLOSED', message: 'Poll already closed' });
    }

    // 7. Determine winner
    const winningOption = determineWinner(pollOptions, pollVotes);

    // 8. If event metadata exists, validate and generate event
    let generatedEventId = null;
    if (eventMeta?.event_date) {
      try {
        validateEventMetadata(eventMeta);

        const { data: creator } = await supabase
          .from('accounts')
          .select('id, full_name, user_type')
          .eq('id', poll.author_id)
          .single();

        if (!creator) throw new Error('Poll creator not found');

        const { data: newEvent, error: eventError } = await supabaseAdmin
          .from('campus_events')
          .insert({
            title: winningOption,
            description: `This event was created from the poll '${poll.title}' - winning option: '${winningOption}'`,
            event_date: eventMeta.event_date,
            event_time: convertTimeToSQL(eventMeta.event_time),
            event_end_date: eventMeta.event_date,
            location: eventMeta.location,
            community_id: poll.community_id || communityId || null,
            poster_id: creator.id,
            category: 'social',
            is_official: false,
          })
          .select()
          .single();

        if (eventError) throw eventError;
        generatedEventId = newEvent.id;

        // Notify all voters
        const voterIds = new Set((voteRows || []).map(v => v.voter_id));
        await notifyVoters(voterIds, poll.title, winningOption, newEvent.id, communityId);

      } catch (validationError) {
        await supabaseAdmin.from('notifications').insert({
          user_id: poll.author_id,
          type: 'event_generation_failed',
          message: `Your poll "${poll.title}" was closed but the event could not be created: ${validationError.message}`,
          link_comm_id: communityId
        });
      }
    }

    // 9. Update announcement_events to mark closed
    if (eventMeta) {
      await supabaseAdmin
        .from('announcement_events')
        .update({
          is_closed: true,
          closed_at: new Date().toISOString(),
          closed_by: closerId,
          ...(generatedEventId ? { generated_event_id: generatedEventId } : {})
        })
        .eq('announcement_id', announcementId);
    } else {
      // No event metadata row yet — create a minimal closed one
      await supabaseAdmin.from('announcement_events').insert({
        announcement_id: announcementId,
        event_date: new Date().toISOString().split('T')[0],
        event_time: '00:00:00',
        location: '',
        is_closed: true,
        closed_at: new Date().toISOString(),
        closed_by: closerId,
        ...(generatedEventId ? { generated_event_id: generatedEventId } : {})
      });
    }

    return res.status(200).json({ success: true, eventId: generatedEventId });

  } catch (error) {
    console.error('Error closing poll:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
}
