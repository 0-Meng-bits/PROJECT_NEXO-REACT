# Implementation Tasks: Poll-to-Event Conversion

## Overview

Implementation checklist for the Poll-to-Event Conversion feature for social communities. The implementation builds upon existing poll infrastructure (announcements table) and calendar functionality (campus_events table), adding event metadata storage and automatic event generation from poll results. Tasks are organized to establish database schema first, then backend logic, and finally frontend components with incremental integration.

**Estimated Time:** ~6-8 hours total

---

## Phase 1: Database Setup

### Task 1.1: Create event_metadata Migration
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create migration file: `supabase/migrations/YYYYMMDD_add_poll_event_metadata.sql`
- [ ] Add ALTER TABLE statement to add event_metadata JSONB column to announcements table
- [ ] Create index: `idx_announcements_event_metadata` on event_metadata WHERE NOT NULL
- [ ] Create index: `idx_announcements_social_polls` on (community_id, post_type) WHERE post_type='poll'
- [ ] Test migration in development environment

**Acceptance Criteria:**
- Migration runs without errors
- event_metadata column added to announcements table
- Indexes created successfully
- _Requirements: 1.2_

---

## Phase 2: Backend Helper Functions

### Task 2.1: Create Validation Helper Functions
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Create validateEventMetadata() function to check date (not past), time (HH:MM format), and location (1-200 chars)
- [ ] Create convertTimeToSQL() function to transform "14:30" to "14:30:00"
- [ ] Add unit tests for date validation (past dates rejected, future dates accepted)
- [ ] Add unit tests for time format validation (valid: "14:30", invalid: "2:30 PM", "14:60")
- [ ] Add unit tests for location validation (1-200 chars, not empty)

**Acceptance Criteria:**
- validateEventMetadata() enforces all validation rules
- convertTimeToSQL() correctly formats time strings
- All unit tests pass
- _Requirements: 7.1, 7.2, 7.3, 9.1, 9.2_

---

### Task 2.2: Create Winner Determination Function
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create determineWinner() function with vote counting logic
- [ ] Implement tie-breaking (first in array wins)
- [ ] Implement zero-vote handling (first option wins)
- [ ] Add unit tests for clear winner scenario
- [ ] Add unit tests for tie scenario
- [ ] Add unit tests for zero votes scenario
- [ ] Add unit tests for single voter
- [ ] Add unit tests for all options equal votes

**Acceptance Criteria:**
- determineWinner() correctly identifies winner in all scenarios
- Tie-breaking is deterministic (first option wins)
- Zero-vote polls select first option
- All unit tests pass
- _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

---

### Task 2.3: Create Notification Helper Function
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create notifyVoters() function to extract voter IDs from poll_votes
- [ ] Implement batch insert logic for notifications
- [ ] Add unit tests to verify all voters notified
- [ ] Add unit tests to verify non-voters not notified

**Acceptance Criteria:**
- notifyVoters() extracts all unique voter IDs from poll_votes
- Batch insert creates notifications for all voters
- Non-voters are not notified
- All unit tests pass
- _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

---

## Phase 3: Poll Closure API Endpoint

### Task 3.1: Create api/close-poll.js Serverless Function
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 2.1, Task 2.2, Task 2.3

**Subtasks:**
- [ ] Create api/close-poll.js file
- [ ] Extract and verify caller identity from Authorization header (use supabase.auth.getUser(token))
- [ ] **CRITICAL:** Derive closerId from verified auth token, NEVER from request body (prevents impersonation)
- [ ] Implement authorization check (verify rank_level > 0 AND status='approved' via memberships query using verified closerId)
- [ ] Fetch poll data with event_metadata
- [ ] **Verify post_type='poll'** before processing (prevent misuse on non-poll announcements)
- [ ] Check if poll already closed
- [ ] Call determineWinner() to get winning option
- [ ] Add integration test for authorization (non-leaders rejected, leaders succeed)
- [ ] Add integration test for already-closed polls
- [ ] Add integration test for non-poll announcements (should be rejected)

**Acceptance Criteria:**
- closerId derived from verified JWT, not request parameters
- Authorization verifies both rank_level > 0 AND status='approved'
- post_type='poll' check prevents processing non-poll posts
- Poll data fetched correctly
- Already-closed polls return error
- Integration tests pass
- _Requirements: 2.2, 2.3_

**Security Note:**
This endpoint MUST derive the caller's identity from the verified session token. Accepting closerId as a request parameter would allow any user to impersonate a community leader and close polls fraudulently.

---

### Task 3.2: Implement Event Generation Logic
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 3.1

**Subtasks:**
- [ ] Validate event_metadata using validateEventMetadata()
- [ ] Fetch poll creator info from accounts table
- [ ] Create campus_events record with all required fields (title, start_date, start_time, location, poster_id/name/type, category='social', is_official=false, description)
- [ ] Store generated_event_id in poll's event_metadata
- [ ] Add integration test for full event generation flow
- [ ] Add integration test to verify event fields mapped correctly

**Acceptance Criteria:**
- Event metadata validated before event creation
- Campus_event record created with correct fields
- generated_event_id stored in poll metadata
- Integration tests pass
- _Requirements: 2.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 6.3_

---

### Task 3.3: Add Error Handling and Graceful Degradation
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 3.2

**Subtasks:**
- [ ] Handle validation failures: close poll without event, notify creator
- [ ] Handle event creation failures: close poll, log error, notify creator
- [ ] Handle notification failures: log error but don't block event creation
- [ ] Add integration tests for validation failure scenarios
- [ ] Add integration tests for event creation failure scenarios

**Acceptance Criteria:**
- Poll closes even if event generation fails
- Creator notified of validation/creation failures
- Notification failures don't prevent event creation
- Integration tests pass
- _Requirements: 7.4, 7.5_

---

### Task 3.4: Update Poll to Closed Status
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 3.2

**Subtasks:**
- [ ] Set event_metadata.is_closed = true, closed_at, closed_by
- [ ] Include generated_event_id if event was created
- [ ] Call notifyVoters() if event was generated

**Acceptance Criteria:**
- Poll metadata updated with closure info
- generated_event_id stored if applicable
- Voters notified if event created
- _Requirements: 2.3, 5.1, 5.2, 5.3, 5.4, 5.5_

---

## Phase 4: Checkpoint - Backend Logic Complete

### Task 4.1: Test Backend API
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** All Phase 3 tasks

**Subtasks:**
- [ ] Test close-poll API with Postman or curl
- [ ] Verify event creation in database
- [ ] Verify notifications sent to voters
- [ ] Verify poll marked as closed
- [ ] Test error scenarios (non-leader, invalid metadata, already closed)

**Acceptance Criteria:**
- API responds correctly to all test cases
- Database records created as expected
- All integration tests pass

---

## Phase 5: Frontend UI Components

### Task 5.1: Create PollEventMetadataForm Component
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create PollEventMetadataForm.jsx file
- [ ] Add props: communityCategory, onChange
- [ ] Render only when communityCategory='social'
- [ ] Add date picker input with validation (not past)
- [ ] Add time picker input with HH:MM format
- [ ] Add location text input with 200 char limit and counter
- [ ] Call onChange with metadata object or null
- [ ] Add CSS styling per design spec

**Acceptance Criteria:**
- Component renders only in social communities
- All input fields validate correctly
- onChange callback called with valid metadata
- _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

---

### Task 5.2: Create EventPollBadge Component
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create EventPollBadge.jsx file
- [ ] Add props: eventDate, eventTime, location
- [ ] Display "Event Poll" label with calendar icon
- [ ] Show event date, time, and location in formatted layout
- [ ] Apply styling from design spec (blue border, light background)

**Acceptance Criteria:**
- Badge displays event metadata clearly
- Styling matches design spec
- _Requirements: 8.1, 8.2_

---

### Task 5.3: Create PollClosureButton Component
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create PollClosureButton.jsx file
- [ ] Add props: announcementId, communityId, userRankLevel, hasEventMetadata, isClosed, onPollClosed
- [ ] Show button only if userRankLevel > 0
- [ ] Button text: "Close Poll & Create Event" if hasEventMetadata, else "Close Poll"
- [ ] Disable button if isClosed
- [ ] Call close-poll API on click
- [ ] Handle errors and show toast messages
- [ ] Apply styling from design spec

**Acceptance Criteria:**
- Button only visible to community leaders
- Button text changes based on hasEventMetadata
- API call succeeds and triggers onPollClosed callback
- Errors displayed to user
- _Requirements: 2.1, 2.4_

---

### Task 5.4: Create GeneratedEventLink Component
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create GeneratedEventLink.jsx file
- [ ] Add props: eventId, eventTitle
- [ ] Render "View Event →" link with styling from design spec
- [ ] Navigate to campus events view on click

**Acceptance Criteria:**
- Link displays with correct styling
- Clicking navigates to campus events view
- _Requirements: 6.1, 6.2, 6.4_

---

### Task 5.5: Create Poll Closed Status Display
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create poll closed banner component
- [ ] Highlight winning option with green background/border
- [ ] Show closure timestamp and closer info
- [ ] Apply styling from design spec

**Acceptance Criteria:**
- Closed banner displays correctly
- Winning option highlighted
- Styling matches design spec
- _Requirements: 8.4_

---

## Phase 6: Integration into Existing Poll UI

### Task 6.1: Modify Poll Creation Modal
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 5.1

**Subtasks:**
- [ ] Import PollEventMetadataForm
- [ ] Render form below poll options input
- [ ] Pass community category to determine visibility
- [ ] Include event_metadata in announcement insert
- [ ] Add client-side validation for metadata fields

**Acceptance Criteria:**
- Form renders in social communities only
- event_metadata included in poll creation
- Client-side validation prevents invalid submissions
- _Requirements: 1.1, 1.2, 1.7_

---

### Task 6.2: Modify AnnouncementCard Component for Poll Display
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 5.2, Task 5.3, Task 5.4, Task 5.5

**Subtasks:**
- [ ] Import all new components (EventPollBadge, PollClosureButton, GeneratedEventLink, poll closed status)
- [ ] Detect polls with event_metadata and render EventPollBadge
- [ ] Check event_metadata.is_closed to disable voting UI
- [ ] Fetch user's rank_level from memberships
- [ ] Render PollClosureButton for community leaders
- [ ] Show GeneratedEventLink if generated_event_id exists
- [ ] Display poll closed status and winning option

**Acceptance Criteria:**
- EventPollBadge renders for polls with event metadata
- Vote buttons disabled for closed polls
- PollClosureButton renders for leaders only
- GeneratedEventLink renders when event exists
- Closed status displays correctly
- _Requirements: 2.4, 6.1, 6.5, 8.1, 8.3, 8.4_

---

### Task 6.3: Add Authorization Helper for Frontend
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create canClosePoll() query function to check user rank_level AND status='approved'
- [ ] Use in AnnouncementCard to conditionally show PollClosureButton
- [ ] Cache result per community to avoid repeated queries

**Acceptance Criteria:**
- canClosePoll() checks both rank_level AND status
- Button visibility controlled by authorization check
- Results cached to optimize performance
- _Requirements: 2.2_

---

## Phase 7: Checkpoint - Frontend Integration Complete

### Task 7.1: Test Complete User Flow
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** All Phase 6 tasks

**Subtasks:**
- [ ] Create event poll in social community
- [ ] Vote on poll from multiple accounts
- [ ] Close poll as community leader
- [ ] Verify event appears in campus_events view
- [ ] Verify GeneratedEventLink navigates correctly
- [ ] Check notifications received by voters

**Acceptance Criteria:**
- Complete flow works end-to-end
- Event created with correct data
- Notifications sent to all voters
- _Requirements: All_

---

## Phase 8: Final Testing

### Task 8.1: Test Edge Cases
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 7.1

**Subtasks:**
- [ ] Test zero-vote poll closure (first option wins)
- [ ] Test tied vote poll closure (first tied option wins)
- [ ] Test poll without event metadata closure (no event)
- [ ] Test non-leader closure attempt (rejected)
- [ ] Test closed poll vote attempt (rejected)
- [ ] Test invalid metadata at close time (poll closes, no event, creator notified)

**Acceptance Criteria:**
- All edge cases handled correctly
- Error messages displayed appropriately
- No crashes or unexpected behavior
- _Requirements: 3.3, 3.4, 2.6, 2.2, 2.4, 7.4, 7.5_

---

### Task 8.2: Test Cross-Community Behavior
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 8.1

**Subtasks:**
- [ ] Verify event metadata fields hidden in academic communities
- [ ] Verify event metadata fields hidden in project communities
- [ ] Verify event metadata fields hidden in hobby communities
- [ ] Verify event metadata fields visible in social communities

**Acceptance Criteria:**
- Event metadata form only appears in social communities
- All other community types exclude the feature
- _Requirements: 1.6_

---

### Task 8.3: Final Verification
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 8.2

**Subtasks:**
- [ ] Verify all acceptance criteria met
- [ ] Check error handling works for all failure scenarios
- [ ] Confirm notifications sent correctly
- [ ] Review code for any remaining console.logs or debug statements

**Acceptance Criteria:**
- All requirements validated
- All tests passing
- Code ready for production

---

## Summary

**Total Estimated Time:** ~6-8 hours  
**Total Tasks:** 22 tasks across 8 phases  
**Dependencies:** Sequential phases with some parallel opportunities

**Critical Path:**
1. Database setup (Phase 1)
2. Backend helper functions (Phase 2)
3. Poll closure API (Phase 3)
4. Frontend components (Phase 5)
5. Integration (Phase 6)
6. Testing (Phases 7-8)

**Notes:**
- Database migration must be run before backend implementation
- Backend API must be tested before frontend integration begins
- Event generation includes graceful degradation if validation fails at close time
- All tasks reference specific requirements for traceability
- Checkpoints ensure incremental validation of backend and frontend independently
