# Design Document: Poll-to-Event Conversion Feature

## Overview

The Poll-to-Event Conversion feature bridges the gap between community decision-making and event scheduling by automatically generating calendar events from poll results. This design leverages the existing announcements table (which already supports polls via poll_options and poll_votes JSONB columns) and the campus_events table, adding event metadata support through a new event_metadata JSONB column. The feature is scoped for social communities only, where activity coordination is a primary use case.

## Architecture Decisions

### Decision 1: Event Metadata Storage Location
**Choice:** Separate event_metadata JSONB column on announcements table  
**Rationale:**
- Keeps event-related data separate from voting data (poll_options contains vote choices, not event details)
- Cleaner queries: can filter polls with event capability via `event_metadata IS NOT NULL`
- Allows storing generated_event_id reference alongside original metadata
- Prevents confusion between poll options (vote choices) and event fields (date/time/location)

**Rejected Alternative:** Nesting event metadata inside poll_options would mix voting data with scheduling data, making queries complex and semantically unclear.

### Decision 2: Manual vs. Automatic Poll Closure
**Choice:** Manual closure only for v1 (community leaders trigger closure)  
**Rationale:**
- No background job infrastructure exists in current system
- Avoids complexity of scheduled tasks or polling mechanisms
- Gives community leaders control over timing
- Simpler implementation and testing

**Deferred to v2:** Automatic time-based closure using lazy-check pattern (poll closes when next user loads it after deadline). Requires storing close_time in metadata and checking on poll load.

### Decision 3: Tie-Breaking Strategy
**Choice:** First option in array wins ties  
**Rationale:**
- Deterministic and predictable behavior
- No additional data storage needed
- Consistent with "first come, first served" pattern
- Simple to implement and explain to users

**Rejected Alternative:** Selecting random option would be non-deterministic and harder to test.

### Decision 4: Winner Determination for Zero-Vote Polls
**Choice:** Select first option as winner  
**Rationale:**
- Allows event generation even when participation is low
- Better than blocking event creation or throwing error
- Maintains consistency with tie-breaking logic
- Poll creator can order options strategically

### Decision 5: Notification Recipients
**Choice:** Notify only users who voted in the poll  
**Rationale:**
- Voters demonstrated interest by participating
- Reduces notification spam for non-engaged members
- Aligns with "opt-in" engagement pattern
- Simple to implement from poll_votes data

**Rejected Alternative:** Notifying all community members would create noise for users who didn't participate in the decision.

## Data Model

### Modified Table: announcements

```sql
-- Add event metadata column to existing announcements table
ALTER TABLE announcements 
  ADD COLUMN IF NOT EXISTS event_metadata jsonb;

-- Index for quickly finding polls with event capability
CREATE INDEX IF NOT EXISTS idx_announcements_event_metadata 
  ON announcements(event_metadata) 
  WHERE event_metadata IS NOT NULL;

-- Example event_metadata structure:
{
  "event_date": "2026-03-15",
  "event_time": "14:30",
  "location": "CTU Gymnasium",
  "is_closed": false,
  "closed_at": "2026-03-10T10:30:00Z",
  "closed_by": "uuid-of-closer",
  "generated_event_id": "uuid-of-created-event"
}
```

### Event Metadata Schema

```javascript
interface PollEventMetadata {
  event_date?: string;        // YYYY-MM-DD format
  event_time?: string;        // HH:MM format (24-hour)
  location?: string;          // Max 200 characters
  is_closed?: boolean;        // Poll closed status
  closed_at?: string;         // ISO timestamp of closure
  closed_by?: string;         // UUID of user who closed poll
  generated_event_id?: string; // UUID of created campus_event
}
```

### Existing Tables Used

**announcements:**
- post_type='poll' identifies poll posts
- poll_options: array of vote choice strings
- poll_votes: object mapping options to voter UUID arrays
- event_metadata: new JSONB column for event details

**campus_events:**
- title, description, start_date, start_time, location
- poster_id, poster_name, poster_type (from poll creator)
- category='social', is_official=false
- **RLS Note:** Existing RLS policy "Verified users can post events" allows authenticated users to insert

**memberships:**
- rank_level > 0 identifies community leaders who can close polls
- status='approved' required for authorization checks

## Component Architecture

### New Component: PollEventMetadataForm

**Purpose:** Input fields for event metadata when creating polls in social communities

**Props:**
```typescript
interface PollEventMetadataFormProps {
  communityCategory: string;
  onChange: (metadata: PollEventMetadata | null) => void;
}
```

**Features:**
- Only renders when communityCategory='social'
- Date picker input (validates not in past)
- Time picker input (HH:MM 24-hour format)
- Location text input (max 200 chars)
- Optional fields (can submit poll without event metadata)

### New Component: PollClosureButton

**Purpose:** Allow community leaders to close polls and trigger event generation

**Props:**
```typescript
interface PollClosureButtonProps {
  announcementId: string;
  communityId: string;
  userRankLevel: number;
  hasEventMetadata: boolean;
  isClosed: boolean;
  onPollClosed: () => void;
}
```

**Features:**
- Only visible to users with rank_level > 0
- Button text: "Close Poll & Create Event" if hasEventMetadata, else "Close Poll"
- Disabled if poll already closed
- Triggers closePoll API call

### New Component: EventPollBadge

**Purpose:** Visual indicator for polls that will generate events

**Props:**
```typescript
interface EventPollBadgeProps {
  eventDate: string;
  eventTime: string;
  location: string;
}
```

**Features:**
- Displays calendar icon with "Event Poll" label
- Shows event date, time, and location below poll options
- Styled with distinct color/border

### New Component: GeneratedEventLink

**Purpose:** Link to campus event from closed poll

**Props:**
```typescript
interface GeneratedEventLinkProps {
  eventId: string;
  eventTitle: string;
}
```

**Features:**
- Only renders when generated_event_id exists in event_metadata
- "View Event →" link navigating to campus events view
- Icon indicating event was created from poll

### Modified Component: AnnouncementCard

**Changes:**
1. Detect polls with event_metadata and render EventPollBadge
2. Check is_closed status to disable voting
3. Show PollClosureButton for community leaders
4. Display GeneratedEventLink when event created
5. Show "Poll Closed" status and winning option

## User Flows

### Flow 1: Creating an Event Poll (Social Community)

```
1. User clicks "New Post" in social community
2. System displays post creation modal
3. User selects "Poll" post type
4. User enters poll title, options
5. System renders PollEventMetadataForm (social only)
6. User optionally fills event date, time, location
7. User clicks "Create"
8. System validates:
   - Poll has at least 2 options ✓
   - If event_metadata provided: date not past, time valid format, location ≤ 200 chars ✓
9. System inserts announcement with post_type='poll', event_metadata populated
10. System displays poll with "Event Poll" badge
```

**Validation:**
- Poll title required (min 3 chars)
- At least 2 poll options required
- Event date must not be in past (if provided)
- Event time must match HH:MM format (if provided)
- Location must not exceed 200 characters (if provided)

### Flow 2: Manually Closing Poll with Event Generation

```
1. Community leader views active poll with event metadata
2. System displays "Close Poll & Create Event" button (rank_level > 0, status='approved')
3. Leader clicks button
4. System validates:
   - User rank_level > 0 AND status='approved' ✓
   - Poll not already closed ✓
   - Event metadata exists ✓
   - Event metadata still valid (date not past, format correct) ✓
5. System determines winning option:
   a. Count votes per option from poll_votes
   b. Select option with highest count
   c. If tie, select first tied option in poll_options array
   d. If zero votes, select first option
6. System creates campus_event record:
   - title = winning option text
   - start_date = event_metadata.event_date
   - start_time = event_metadata.event_time
   - location = event_metadata.location
   - poster_id/name/type = poll creator info
   - category = 'social'
   - is_official = false
   - description = "This event was created from the poll '[Title]' - winning option: '[Option]'"
7. System updates poll:
   - event_metadata.is_closed = true
   - event_metadata.closed_at = now()
   - event_metadata.closed_by = leader UUID
   - event_metadata.generated_event_id = new event UUID
8. System creates notifications:
   - For each user ID in poll_votes (all voters)
   - Type: 'event_from_poll'
   - Message: "The poll '[Poll Title]' has closed! Event created: [Event Title]"
   - link_comm_id = community UUID or event UUID
9. System displays poll with "Poll Closed" status
10. System shows GeneratedEventLink component
11. Voters receive notifications
```

**Error Handling:**
- If authorization fails: Show toast "Only community leaders can close polls"
- If event metadata invalid at close time: Close poll without generating event, notify creator with validation error
- If event creation fails: Roll back poll closure, show error to closer

### Flow 3: Closing Poll Without Event Metadata

```
1. Community leader views active poll without event metadata
2. System displays "Close Poll" button
3. Leader clicks button
4. System validates user rank_level > 0 AND status='approved'
5. System updates event_metadata:
   - is_closed = true
   - closed_at = now()
   - closed_by = leader UUID
6. System does NOT create campus_event
7. System does NOT send notifications
8. System displays "Poll Closed" status with winning option
```

### Flow 4: Attempting to Vote on Closed Poll

```
1. User views closed poll
2. System disables vote buttons
3. System displays "Poll Closed" message
4. If user clicks disabled button, show toast: "This poll is closed"
5. System shows vote distribution and winning option highlighted
```


## Technical Specifications

### API: Close Poll and Generate Event

**Security Note:** This is a serverless API endpoint. The caller's identity MUST be derived from the verified authentication token, not from request parameters. Accepting closerId as a request parameter would allow impersonation attacks where any user could claim to be a community leader.

```javascript
async function closePoll(req, res) {
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
    .select('*, author_id, title, poll_options, poll_votes, event_metadata')
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
  const winningOption = determineWinner(poll.poll_options, poll.poll_votes);
  
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
      await notifyVoters(poll.poll_votes, poll.title, winningOption, newEvent.id, communityId);
      
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
}
```

### Helper: Determine Winning Option

```javascript
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
```

### Helper: Validate Event Metadata

```javascript
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
```

### Helper: Convert Time to SQL Format

```javascript
function convertTimeToSQL(timeString) {
  // Input: "14:30" (HH:MM)
  // Output: "14:30:00" (HH:MM:SS)
  return `${timeString}:00`;
}
```

### Helper: Notify Voters

```javascript
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
```

### Query: Check if User Can Close Poll

```javascript
async function canClosePoll(userId, communityId) {
  const { data, error } = await supabase
    .from('memberships')
    .select('rank_level')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .eq('status', 'approved')
    .single();
  
  return !error && data && data.rank_level > 0;
}
```

### Query: Get Poll Closure Status

```javascript
async function getPollStatus(announcementId) {
  const { data, error } = await supabase
    .from('announcements')
    .select('event_metadata')
    .eq('id', announcementId)
    .single();
  
  if (error || !data) return { isClosed: false };
  
  return {
    isClosed: data.event_metadata?.is_closed || false,
    closedAt: data.event_metadata?.closed_at,
    closedBy: data.event_metadata?.closed_by,
    generatedEventId: data.event_metadata?.generated_event_id
  };
}
```

## UI/UX Specifications

### Event Poll Badge

```css
.event-poll-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid #3b82f6;
  color: #3b82f6;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.event-poll-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.05);
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.event-poll-info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-poll-info-item i {
  color: #3b82f6;
  width: 16px;
}
```

### Poll Closure Button

```css
.close-poll-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 12px;
}

.close-poll-button:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.close-poll-button:disabled {
  background: rgba(239, 68, 68, 0.3);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.close-poll-button.create-event {
  background: linear-gradient(135deg, #10b981, #059669);
}

.close-poll-button.create-event:hover {
  background: linear-gradient(135deg, #059669, #047857);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
```

### Poll Closed Status

```css
.poll-closed-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.3);
  border-radius: 8px;
  margin-bottom: 12px;
}

.poll-closed-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-muted);
  font-size: 13px;
}

.winning-option-highlight {
  background: rgba(16, 185, 129, 0.15);
  border-left: 3px solid #10b981;
  padding-left: 12px;
}
```

### Generated Event Link

```css
.generated-event-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  border-radius: 8px;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  margin-top: 12px;
}

.generated-event-link:hover {
  background: rgba(59, 130, 246, 0.2);
  transform: translateX(4px);
}

.generated-event-link i {
  font-size: 14px;
}
```

### Disabled Vote Buttons (Closed Poll)

```css
.poll-option-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.poll-option-button.disabled:hover {
  transform: none;
  box-shadow: none;
}
```

## Security Considerations

### Critical Security Requirements

**Identity Verification:**
- The close-poll API endpoint MUST derive the caller's identity from the verified JWT token in the Authorization header
- NEVER accept closerId as a request parameter - this would allow impersonation attacks where any user could claim to be a community leader
- Use `supabase.auth.getUser(token)` to extract the verified user ID from the session

**Post Type Validation:**
- The close-poll endpoint MUST verify `post_type='poll'` before processing
- This prevents the endpoint from being called with arbitrary announcement IDs
- Misuse on non-poll posts should return a 400 Bad Request error

### Authorization Layers

**Database Level (RLS):**
- Existing announcements table RLS allows service role to update
- campus_events table allows authenticated users to insert (verified by existing "Verified users can post events" policy)
- notifications table allows inserting for target users

**Application Level:**
- Poll closure: Verify rank_level > 0 AND status='approved' via memberships query
- Poll voting: Check event_metadata.is_closed before accepting votes
- Event metadata validation: Enforce date/time/location constraints
- Notification creation: Only notify users present in poll_votes

### Validation Rules

**Poll Creation:**
- Event date must not be in past (client-side and server-side)
- Time format must match HH:MM regex
- Location must not exceed 200 characters
- Only available in social communities

**Poll Closure:**
- Only users with rank_level > 0 AND status='approved' can close
- Poll cannot be closed twice
- Event metadata revalidated at close time (dates may have become invalid)

**Event Generation:**
- All poll metadata fields required (date, time, location)
- Poll creator info must exist in accounts table
- Winning option must exist in poll_options

### Data Integrity

**Constraints:**
- event_metadata is JSONB with no schema enforcement at DB level
- Application validates structure before use
- generated_event_id references must be valid UUIDs (enforced by campus_events foreign key)

**Transaction Safety:**
- If event creation fails, poll still closes (graceful degradation)
- Creator notified of failure
- No orphan events (each event tied to poll via generated_event_id)

## Performance Considerations

### Indexing Strategy

```sql
-- Index for finding event-capable polls
CREATE INDEX IF NOT EXISTS idx_announcements_event_metadata 
  ON announcements(event_metadata) 
  WHERE event_metadata IS NOT NULL;

-- Index for finding social community polls
CREATE INDEX IF NOT EXISTS idx_announcements_social_polls 
  ON announcements(community_id, post_type) 
  WHERE post_type = 'poll';

-- Existing index on campus_events for date queries
-- (already exists from previous migrations)
```

### Query Optimization

**Poll Closure:**
- Single query to fetch poll data
- Single query to check leader status
- Single insert for event creation
- Batch insert for notifications (one query for all voters)
- Single update for poll closure

**Poll Display:**
- event_metadata loaded with announcement (no extra query)
- Winning option calculated client-side from poll_votes
- Leader status cached per community (no repeated checks)

### Scalability

**Voter Notification:**
- Typical social community: 20-50 members
- Typical poll participation: 50-70% (10-35 voters)
- Batch insert handles up to 100 notifications efficiently
- For larger communities, consider notification batching service (v2)

**Event Generation:**
- Single event per poll (1:1 relationship)
- Event creation is synchronous with poll closure
- No background jobs needed
- Maximum latency: 1-2 seconds for closure + event creation

## Error Handling

### Client-Side Validation

**Poll Creation:**
- Empty title/options: Show inline error "Title and options required"
- Date in past: Show inline error "Event date cannot be in the past"
- Invalid time format: Show inline error "Time must be HH:MM format"
- Location too long: Show character counter, disable submit when > 200

**Poll Closure:**
- Not a leader: Hide button entirely
- Already closed: Disable button, show "Poll Closed" label
- Network error: Show toast "Unable to close poll. Please try again."

### Server-Side Error Responses

**Authorization Errors:**
```javascript
{
  error: 'UNAUTHORIZED',
  message: 'Only community leaders can close polls',
  code: 403
}
```

**Validation Errors:**
```javascript
{
  error: 'INVALID_METADATA',
  message: 'Event date cannot be in the past',
  field: 'event_date',
  code: 400
}
```

**State Errors:**
```javascript
{
  error: 'POLL_ALREADY_CLOSED',
  message: 'This poll has already been closed',
  code: 409
}
```

### Graceful Degradation

**Event Generation Failure:**
- Poll still closes successfully
- Creator receives notification with error details
- Users can still view poll results
- Leader can manually create event from calendar view

**Notification Failure:**
- Event still created successfully
- Error logged but not shown to user
- Users can discover event via calendar view
- Notification system retries in background (if implemented in v2)

**Partial Vote Data:**
- If poll_votes is malformed, treat as zero votes
- Select first option as winner
- Log warning for debugging
- Event generation proceeds normally

## Testing Strategy

### Unit Tests

**Winner Determination:**
- Test with clear winner (option with most votes)
- Test with tie (first option in array wins)
- Test with zero votes (first option selected)
- Test with single voter
- Test with all options having equal votes

**Validation Functions:**
- Date in past rejection
- Valid date acceptance
- Time format regex matching (valid: "14:30", invalid: "2:30 PM", "14:60")
- Location length enforcement (199 chars ok, 201 chars rejected)
- Empty location rejection

**Format Conversion:**
- Time conversion "14:30" → "14:30:00"
- Date format validation "2026-03-15" → valid SQL date

### Integration Tests

**Full Event Generation Flow:**
1. Create poll with event metadata in social community
2. Cast votes from multiple users
3. Close poll as community leader
4. Verify campus_event created with correct fields
5. Verify voters receive notifications
6. Verify poll shows generated_event_id
7. Verify poll rejects new votes

**Poll Closure Without Event:**
1. Create poll without event metadata
2. Close poll as leader
3. Verify no campus_event created
4. Verify no notifications sent
5. Verify poll marked as closed

**Authorization:**
1. Attempt closure as non-leader (should fail)
2. Attempt closure as rank_level=0 member (should fail)
3. Attempt closure as rank_level=1 leader (should succeed)
4. Attempt closure as rank_level>0 but status!='approved' (should fail)

### Manual Testing Scenarios

1. **Happy Path:** Create event poll → Vote → Close as leader → Verify event created
2. **No Participation:** Create event poll → Close immediately → Verify first option becomes event
3. **Tie Scenario:** Create 2-option poll → Get equal votes → Close → Verify first option wins
4. **Invalid Metadata:** Create poll with past date → Close → Verify poll closes but no event
5. **Non-Leader Attempt:** Create poll → Try to close as regular member → Verify rejected
6. **Non-Social Community:** Try to add event metadata in academic community → Verify fields hidden
7. **Edit After Closure:** Close poll → Attempt to vote → Verify vote rejected
8. **Notification Delivery:** Close poll with 5 voters → Verify all 5 receive notifications
9. **Event Link:** Close poll → Click "View Event" → Verify navigates to campus event
10. **Long Location:** Enter 201-character location → Verify validation error

## Migration Plan

### Step 1: Database Migration

```sql
-- File: supabase/migrations/YYYYMMDD_add_poll_event_metadata.sql

-- Add event_metadata column to announcements
ALTER TABLE announcements 
  ADD COLUMN IF NOT EXISTS event_metadata jsonb;

-- Create index for event-capable polls
CREATE INDEX IF NOT EXISTS idx_announcements_event_metadata 
  ON announcements(event_metadata) 
  WHERE event_metadata IS NOT NULL;

-- Create index for social community polls
CREATE INDEX IF NOT EXISTS idx_announcements_social_polls 
  ON announcements(community_id, post_type) 
  WHERE post_type = 'poll';
```

### Step 2: Backend API Implementation

1. Create `api/close-poll.js` serverless function
2. Implement `closePoll`, `determineWinner`, `validateEventMetadata` helpers
3. Add authorization check via memberships query (rank_level > 0 AND status='approved')
4. Add event creation logic
5. Add voter notification logic
6. Add error handling and logging

### Step 3: Frontend Components

1. Create `PollEventMetadataForm.jsx` component
2. Create `PollClosureButton.jsx` component
3. Create `EventPollBadge.jsx` component
4. Create `GeneratedEventLink.jsx` component
5. Modify `AnnouncementCard` to integrate new components
6. Add poll closure handler to `UserPortal.jsx`
7. Update poll creation modal to include event metadata form

### Step 4: Testing & Deployment

1. Run unit tests (validation, winner determination)
2. Run integration tests (full flow)
3. Manual testing in development environment
4. Deploy database migration
5. Deploy backend API
6. Deploy frontend changes
7. Monitor error logs for first 24 hours

### Rollback Plan

**If Critical Issues Detected:**
1. Revert frontend changes (users can't create event polls)
2. Backend remains deployed (doesn't break existing polls)
3. Database column remains (no data loss)
4. Fix issues in development
5. Re-deploy when ready

**Database Rollback (if needed):**
```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_announcements_event_metadata;
DROP INDEX IF EXISTS idx_announcements_social_polls;

-- Remove column (WARNING: data loss)
ALTER TABLE announcements DROP COLUMN IF EXISTS event_metadata;
```

## Future Enhancements (Out of Scope for v1)

### Automatic Time-Based Poll Closure

**Approach:** Lazy-check pattern  
**Implementation:** 
- Add close_time field to event_metadata during poll creation
- When any user loads a poll, check if current time > close_time
- If true, trigger automatic closure and event generation
- No background jobs or schedulers needed

**Benefits:**
- No new infrastructure required
- Event-driven (happens when user interacts)
- Scales naturally with user activity

**Deferred Because:** Adds complexity to poll loading logic, requires careful state management to avoid race conditions.

### Formal Property-Based Testing

Formal property-based testing for invariants like vote-counting accuracy and winner determinism was considered but deferred given timeline; standard unit/integration tests cover these cases for v1.

### Countdown Timer Display

**Feature:** Show "Closes in X hours Y minutes" on event polls  
**Requires:** close_time field from automatic closure feature  
**UI:** Real-time countdown using JavaScript setInterval  
**Deferred Because:** Not meaningful without automatic closure deadline.

### Edit Event After Generation

**Feature:** Allow poll creator or community leaders to edit generated event  
**Implementation:** 
- Add "Edit Event" button on generated event link
- Open event editing modal (reuse campus events edit UI)
- Update campus_events record
- Notify voters of change

**Deferred Because:** Adds complexity around change notifications and event update permissions.

### Revote/Reopen Poll

**Feature:** Allow leaders to reopen closed poll for additional voting  
**Implementation:**
- Add "Reopen Poll" button for closed polls
- Clear is_closed flag
- Optionally delete generated event (or mark as cancelled)
- Notify voters of reopening

**Deferred Because:** Introduces complex state transitions and potential confusion around "final" decisions.

### Multiple Event Generation

**Feature:** Create events for top N options (e.g., winner + runner-up)  
**Use Case:** "Let's do both activities!"  
**Implementation:**
- Add "Create events for top N" option during closure
- Generate multiple events with different dates/times
- Store array of generated_event_ids

**Deferred Because:** Complicates metadata structure (need multiple date/time/location sets) and significantly increases scope.

### Weighted Voting

**Feature:** Give different weight to votes based on rank_level or trust_points  
**Implementation:**
- Modify vote counting to multiply votes by weight
- Display weighted vote counts
- Update winner determination logic

**Deferred Because:** Changes fundamental voting mechanics, requires UI changes to explain weighting, and adds complexity to vote counting.

### Integration with External Calendars

**Feature:** Export generated events to Google Calendar, iCal  
**Implementation:**
- Add "Add to Calendar" button on generated events
- Generate .ics file or Google Calendar link
- Include event details and location

**Deferred Because:** Requires external API integration and OAuth flows for calendar access.

---

## Summary

This design document specifies a poll-to-event conversion feature that seamlessly transforms community voting results into scheduled events. By storing event metadata separately from poll options, validating data at both creation and closure time, and automatically notifying voters, the system creates a smooth workflow from decision-making to action. The manual closure approach keeps v1 simple while leaving room for automatic closure in v2, and standard unit/integration tests ensure correctness across all input scenarios.
