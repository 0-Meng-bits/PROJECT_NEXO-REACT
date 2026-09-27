import { supabase, supabaseAdmin } from './_supabase.js';

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Validate event metadata fields
 * @param {Object} metadata - Event metadata object
 * @throws {Error} If validation fails
 */
function validateEventMetadata(metadata) {
  // Validate date
  if (!metadata.event_date) {
    throw new Error('Event date is required');
  }
  
  const eventDate = new Date(metadata.event_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (eventDate < today) {
    throw new Error('Event date cannot be in the past');
  }
  
  // Validate time format
  if (!metadata.event_time) {
    throw new Error('Event time is required');
  }
  
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(metadata.event_time)) {
    throw new Error('Event time must be in HH:MM format (24-hour)');
  }
  
  // Validate location
  if (!metadata.location || metadata.location.trim() === '') {
    throw new Error('Location is required');
  }
  
  if (metadata.location.length > 200) {
    throw new Error('Location cannot exceed 200 characters');
  }
}

/**
 * Convert time string to SQL format
 * @param {string} timeString - Time in HH:MM format
 * @returns {string} Time in HH:MM:SS format
 */
function convertTimeToSQL(timeString) {
  return `${timeString}:00`;
}

/**
 * Determine the winning poll option
 * @param {string[]} pollOptions - Array of poll option strings
 * @param {Object} pollVotes - Object mapping options to voter UUID arrays
 * @returns {string} The winning option text
 */
function determineWinner(pollOptions, pollVotes) {
  if (!pollOptions || pollOptions.length === 0) {
    throw new Error('Poll has no options');
  }
  
  // Count votes per option
  const voteCounts = {};
  pollOptions.forEach(option => {
    voteCounts[option] = (pollVotes[option] || []).length;
  });
  
  // Find max vote count
  const maxVotes = Math.max(...Object.values(voteCounts));
  
  // If no votes (maxVotes = 0), return first option
  if (maxVotes === 0) {
    return pollOptions[0];
  }
  
  // Find first option with max votes (handles ties)
  for (const option of pollOptions) {
    if (voteCounts[option] === maxVotes) {
      return option;
    }
  }
  
  // Fallback (should never reach here)
  return pollOptions[0];
}

/**
 * Notify all voters about event creation
 * @param {Object} pollVotes - Poll votes object
 * @param {string} pollTitle - Poll title
 * @param {string} eventTitle - Created event title
 * @param {string} eventId - Created event UUID
 * @param {string} communityId - Community UUID
 */
async function notifyVoters(pollVotes, pollTitle, eventTitle, eventId, communityId) {
  // Extract all voter UUIDs from poll_votes
  const voterIds = new Set();
  Object.values(pollVotes).forEach(voters => {
    voters.forEach(voterId => voterIds.add(voterId));
  });
  
  // Create notifications for each voter
  const notifications = Array.from(voterIds).map(voterId => ({
    user_id: voterId,
    type: 'event_from_poll',
    message: `The poll '${pollTitle}' has closed! Event created: ${eventTitle}`,
    link_comm_id: communityId,
    is_read: false
  }));
  
  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
}

// ── MAIN API HANDLER ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' });
  }
  
  try {
    // 0. Extract and verify caller identity from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No authorization header' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid auth token' });
    }
    
    const closerId = user.id; // Derive from verified session, never from request body
    
    // Extract parameters from request body
    const { announcementId, communityId } = req.body;
    
    if (!announcementId || !communityId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'announcementId and communityId required' });
    }
    
    // 1. Authorization: Verify user is community leader with approved status
    const { data: membership, error: memberError } = await supabase
      .from('memberships')
      .select('rank_level')
      .eq('user_id', closerId)
      .eq('community_id', communityId)
      .eq('status', 'approved')
      .single();
    
    if (memberError || !membership || membership.rank_level <= 0) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only community leaders can close polls' });
    }
    
    // 2. Fetch poll data
    const { data: poll, error: pollError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', announcementId)
      .single();
    
    if (pollError || !poll) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Poll not found' });
    }
    
    // 3. Verify this is actually a poll post
    if (poll.post_type !== 'poll') {
      return res.status(400).json({ error: 'INVALID_TYPE', message: 'This announcement is not a poll' });
    }
    
    // 4. Check if already closed
    if (poll.event_metadata?.is_closed) {
      return res.status(409).json({ error: 'ALREADY_CLOSED', message: 'Poll already closed' });
    }
    
    // 5. Determine winning option
    const winningOption = determineWinner(poll.poll_options, poll.poll_votes || {});
    
    // 6. If event metadata exists, validate and generate event
    let generatedEventId = null;
    if (poll.event_metadata?.event_date) {
      try {
        // Validate metadata
        validateEventMetadata(poll.event_metadata);
        
        // Fetch creator info
        const { data: creator } = await supabase
          .from('accounts')
          .select('id, full_name, user_type')
          .eq('id', poll.author_id)
          .single();
        
        if (!creator) {
          throw new Error('Poll creator not found');
        }
        
        // Create event
        const { data: newEvent, error: eventError } = await supabase
          .from('campus_events')
          .insert({
            title: winningOption,
            description: `This event was created from the poll '${poll.title}' - winning option: '${winningOption}'`,
            start_date: poll.event_metadata.event_date,
            start_time: convertTimeToSQL(poll.event_metadata.event_time),
            location: poll.event_metadata.location,
            poster_id: creator.id,
            poster_name: creator.full_name,
            poster_type: creator.user_type,
            category: 'social',
            is_official: false
          })
          .select()
          .single();
        
        if (eventError) throw eventError;
        generatedEventId = newEvent.id;
        
        // Notify voters
        await notifyVoters(poll.poll_votes || {}, poll.title, winningOption, newEvent.id, communityId);
        
      } catch (validationError) {
        // If event generation fails, still close poll but notify creator
        await supabase.from('notifications').insert({
          user_id: poll.author_id,
          type: 'event_generation_failed',
          message: `Your poll "${poll.title}" was closed but the event could not be created: ${validationError.message}`,
          link_comm_id: communityId
        });
      }
    }
    
    // 7. Update poll to closed status
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        event_metadata: {
          ...poll.event_metadata,
          is_closed: true,
          closed_at: new Date().toISOString(),
          closed_by: closerId,
          ...(generatedEventId && { generated_event_id: generatedEventId })
        }
      })
      .eq('id', announcementId);
    
    if (updateError) {
      return res.status(500).json({ error: 'UPDATE_FAILED', message: 'Failed to update poll status' });
    }
    
    return res.status(200).json({ success: true, eventId: generatedEventId });
    
  } catch (error) {
    console.error('Error closing poll:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
}
