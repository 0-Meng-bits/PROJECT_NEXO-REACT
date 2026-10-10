# Implementation Plan: NEXO Connect Features

## Overview

Incremental implementation of ten features across the NEXO Connect platform: gender field at signup, onboarding interest gate, Discover People page, connection system, updated circle creation, circle rules, notification improvements, daily login streak, YouTube tutorial embed, and supporting database schema changes. Each task builds on previous steps and wires into the existing React/Vite + Supabase architecture.

## Tasks

- [x] 1. Database schema migrations
  - Create Supabase migration file adding `gender` and `discoverable` columns to `account_details`
  - Create migration adding `interest_tag`, `is_open`, and `status` columns to `communities`
  - Create migration for new `connections` table with indexes and constraints per design
  - Create migration for new `blocks` table with indexes and constraints
  - Create migration for new `login_streaks` table
  - Create migration adding `category`, `group_key`, and `group_count` columns to `notifications`
  - Create migration for new `notification_mutes` table
  - Add RLS policies for `connections`, `blocks`, `login_streaks`, and `notification_mutes` as specified in design
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 2. Constants and shared utilities
  - [x] 2.1 Create `src/lib/constants.js` with `NEXO_YOUTUBE_EMBED_URL`, `CATEGORY_INTEREST_MAP`, and `ALL_NOTIFICATION_TYPES` exports
    - `CATEGORY_INTEREST_MAP` maps Academic/Hobby/Social/Project to their interest arrays
    - `NEXO_YOUTUBE_EMBED_URL` is the single-source YouTube embed URL
    - _Requirements: 5.2, 9.4_

  - [ ]* 2.2 Write property test for `CATEGORY_INTEREST_MAP` completeness
    - **Property 21: Interest tag filtered by category**
    - **Validates: Requirements 5.2**

- [x] 3. Gender field at signup
  - [x] 3.1 Add `gender` `<select>` field to `Auth.jsx` signup form between user type and password fields, with options `Male`, `Female`, `Prefer not to say` and HTML5 `required`
    - Pass `gender` in the POST body to `/api/signup`
    - _Requirements: 1.3_

  - [x] 3.2 Extend `/api/signup.js` to accept, validate, and persist `gender` to `account_details`
    - Return HTTP 400 with `"Invalid gender value."` if value is not one of the three allowed strings
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ]* 3.3 Write property test for gender signup round-trip
    - **Property 2: Gender signup round-trip**
    - **Validates: Requirements 1.2**

  - [ ]* 3.4 Write property test for gender column constraint
    - **Property 1: Gender column accepts only valid values**
    - **Validates: Requirements 1.1, 1.5**

- [x] 4. Onboarding interest gate
  - [x] 4.1 Add `disabled={selectedInterests.length === 0}` to the "ENTER NEXO" button in `Onboarding.jsx` Step 3
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 Write property test for interest gate invariant
    - **Property 3: Interest gate invariant**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 5. YouTube tutorial embed
  - [x] 5.1 Add the tutorial `<iframe>` to `Landing.jsx` between the "How it works" section and "About", importing `NEXO_YOUTUBE_EMBED_URL` from `src/lib/constants.js`
    - _Requirements: 9.1, 9.4_

  - [x] 5.2 Add the tutorial `<iframe>` to `HelpModal.jsx` (video tab or top of Guide tab), importing the same constant
    - _Requirements: 9.2, 9.4_

  - [x] 5.3 Add the tutorial `<iframe>` below the avatar upload section in `Onboarding.jsx` Step 1, importing the same constant
    - _Requirements: 9.3, 9.4_

  - [ ]* 5.4 Write unit tests verifying all three embed locations render an `<iframe>` with `src` matching `NEXO_YOUTUBE_EMBED_URL`
    - Test `Landing.jsx`, `HelpModal.jsx`, and `Onboarding.jsx` Step 1
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 6. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Connection system API — `/api/connections.js`
  - [x] 7.1 Create `/api/connections.js` with GET handler returning viewer's connections and pending requests
    - Query `connections` table for all records where `user_id` or `connected_user_id` equals viewer
    - _Requirements: 4.8_

  - [x] 7.2 Implement `request` action: insert pending connection, enforce no-duplicate and 7-day cooldown rules, insert `connection_request` notification with `category='Connections'`
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [ ]* 7.3 Write property test for no duplicate pending connections
    - **Property 15: No duplicate pending connections**
    - **Validates: Requirements 4.5**

  - [x] 7.4 Implement `accept` action: update status to `accepted`, insert `connection_accepted` notification for requester with `category='Connections'`
    - _Requirements: 4.3_

  - [ ]* 7.5 Write property test for connection creation and notification
    - **Property 12: Connection creation and notification**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 7.6 Implement `decline` action: update status to `declined`, no notification sent to requester
    - _Requirements: 4.4_

  - [x] 7.7 Implement `remove` action: delete connection record without altering memberships
    - _Requirements: 4.9_

  - [ ]* 7.8 Write property test for connection removal preserving memberships
    - **Property 17: Connection removal preserves memberships**
    - **Validates: Requirements 4.9**

  - [x] 7.9 Implement `block` action: insert into `blocks`, delete any connection between the pair, no notification to blocked user
    - _Requirements: 4.10_

  - [x] 7.10 Implement `unblock` action: delete from `blocks`
    - _Requirements: 4.10_

  - [ ]* 7.11 Write property test for block creating record and removing connection
    - **Property 18: Block creates record and removes connection**
    - **Validates: Requirements 4.10_**

- [x] 8. Discover People API — `/api/discover.js`
  - [x] 8.1 Create `/api/discover.js` GET handler querying verified, discoverable, interest-populated users excluding viewer and blocked users
    - Join `account_details` with `account_status`, filter `is_verified=true`, `discoverable=true`, `interests` non-empty
    - Exclude viewer and users blocked in either direction
    - _Requirements: 3.2, 3.3_

  - [ ]* 8.2 Write property test for discover page showing only valid users
    - **Property 5: Discover page shows only valid users**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 8.3 Add suggested view ordering: sort results so users sharing at least one interest with the viewer rank first
    - _Requirements: 3.4_

  - [ ]* 8.4 Write property test for suggested view ordering
    - **Property 6: Discover suggested view ordering**
    - **Validates: Requirements 3.4**

  - [x] 8.5 Add open circles to the response: query `communities` where `is_open=true`, annotate circles where viewer has a connection who is a member
    - _Requirements: 3.8, 3.9_

  - [ ]* 8.6 Write property test for open circle visibility
    - **Property 9: Discover Open Circle visibility**
    - **Validates: Requirements 3.8, 6.6**

- [x] 9. DiscoverPeople component
  - [x] 9.1 Create `capstone-react/src/components/DiscoverPeople.jsx` with two view tabs ("All" grouped by interest, "Suggested" overlap-first), interest filter chips, and user cards showing name, interests, course, and connection status
    - Fetch from `/api/discover` on mount
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [ ]* 9.2 Write property test for user card completeness
    - **Property 8: Discover user card completeness**
    - **Validates: Requirements 3.6**

  - [x] 9.3 Add Open Circle cards alongside user cards; visually highlight circles where viewer has a connected member
    - _Requirements: 3.8, 3.9_

  - [x] 9.4 Add Connect button to user cards — visible only when no accepted/pending connection and no block exists
    - Wire Connect button to `POST /api/connections` with `action: 'request'`
    - _Requirements: 3.10, 4.1_

  - [ ]* 9.5 Write property test for Connect button visibility rule
    - **Property 11: Connect button visibility rule**
    - **Validates: Requirements 3.10**

  - [ ]* 9.6 Write property test for interest filter correctness
    - **Property 7: Discover interest filter correctness**
    - **Validates: Requirements 3.5**

  - [x] 9.7 Add `{ key: 'discover', label: 'Discover', icon: 'fa-solid fa-user-magnifying-glass' }` to the sidebar navigation array in `UserPortal.jsx` adjacent to the Campus Events tab, and render `<DiscoverPeople />` when that section is active
    - _Requirements: 3.1_

- [x] 10. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Notification improvements
  - [x] 11.1 Create `notificationCategory(type)` utility function in `src/lib/constants.js` mapping each notification type to `Connections`, `Circles`, or `Campus` per the design's category mapping table
    - _Requirements: 7.2_

  - [ ]* 11.2 Write property test for notification category mapping being total
    - **Property 34: Notification category mapping is total**
    - **Validates: Requirements 7.2**

  - [x] 11.3 Create `insertNotification(params)` helper (can live in `src/lib/api.js` or a new `src/lib/notifications.js`) implementing grouping logic: check for an unread record with the same `group_key` within the last 10 minutes; if found, increment `group_count`; if muted, skip insert; otherwise insert new row
    - _Requirements: 7.1, 7.3_

  - [ ]* 11.4 Write property test for notification grouping reducing count
    - **Property 33: Notification grouping reduces count**
    - **Validates: Requirements 7.1**

  - [ ]* 11.5 Write property test for muted category suppressing notifications
    - **Property 35: Muted category suppresses notifications**
    - **Validates: Requirements 7.3**

  - [x] 11.6 Add mute toggle UI to the user profile settings in `UserPortal.jsx` allowing the user to mute/unmute each of the three categories; persist to `notification_mutes` table
    - _Requirements: 7.3_

  - [x] 11.7 Update all existing `supabase.from('notifications').insert(...)` call sites in `UserPortal.jsx`, `AdminDashboard.jsx`, and `/api/*.js` files to use `insertNotification()` so grouping and muting are applied consistently
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 12. Login streak service
  - [x] 12.1 Extract `processLoginStreak(userId)` helper implementing the state machine defined in the design: first login inserts row with streak=1; same-day re-login skips; consecutive day increments; 1–2 missed days preserves streak (grace period); 3+ missed days resets to 1; awards `min(streak_count, 5)` trust points capped at 10
    - Place in `/api/login.js` or a co-located helper file
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.10_

  - [ ]* 12.2 Write property test for login streak state machine
    - **Property 36: Login streak state machine**
    - **Validates: Requirements 8.1, 8.2, 8.5, 8.6**

  - [ ]* 12.3 Write property test for trust points award schedule
    - **Property 37: Trust points award schedule**
    - **Validates: Requirements 8.3**

  - [ ]* 12.4 Write property test for trust points cap at 10
    - **Property 38: Trust points cap at 10**
    - **Validates: Requirements 8.4**

  - [x] 12.5 Call `processLoginStreak(userId)` inside `/api/login.js` after successful authentication and include `{ streak, points_awarded }` in the login response
    - _Requirements: 8.1, 8.3_

  - [x] 12.6 Add streak toast in `App.jsx` or `UserPortal.jsx`: after login, if `points_awarded > 0`, show `"🔥 Day {streak} Streak! +{points} Trust Points"` for 4 seconds
    - _Requirements: 8.7, 8.8_

  - [ ]* 12.7 Write property test for streak toast containing required information
    - **Property 39: Streak toast contains required information**
    - **Validates: Requirements 8.7, 8.8**

  - [x] 12.8 Load `login_streaks` on portal mount and display flame icon + streak count in the `Portal_Header`; display streak count alongside the trust points badge in the profile modal
    - _Requirements: 8.8, 8.9_

  - [ ]* 12.9 Write property test for login streaks round-trip
    - **Property 40: Login streaks round-trip**
    - **Validates: Requirements 8.10, 10.3**

- [x] 13. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Updated circle creation
  - [x] 14.1 Add connection count gate to the Circle Creation flow in `UserPortal.jsx`: before rendering the form, fetch the viewer's accepted connections from `/api/connections`; if count < 2, show inline message "You need 2 connections to create a circle" and do not render the form
    - _Requirements: 5.1_

  - [ ]* 14.2 Write property test for connection gate for circle creation
    - **Property 20: Connection gate for circle creation**
    - **Validates: Requirements 5.1**

  - [x] 14.3 Add `Interest_Tag` dropdown to the Circle Creation form, filtering options client-side using `CATEGORY_INTEREST_MAP[selectedCategory]` from `src/lib/constants.js`
    - _Requirements: 5.2_

  - [x] 14.4 Add "Open for Applications" toggle to the Circle Creation form setting `is_open`
    - _Requirements: 5.3_

  - [ ]* 14.5 Write property test for `is_open` round-trip
    - **Property 22: is_open round-trip**
    - **Validates: Requirements 5.3**

  - [x] 14.6 Restrict the invite list in the Circle Creation form to the creator's connections array (populated from `/api/connections`); submit invite list with circle creation POST
    - _Requirements: 5.4_

  - [ ]* 14.7 Write property test for invite list restricted to connections
    - **Property 23: Invite list restricted to connections**
    - **Validates: Requirements 5.4**

  - [x] 14.8 Extend `/api/communities.js` circle creation POST to: insert into `communities` with `status='pending'`, `is_open`, `interest_tag`; insert `memberships` rows for creator and invitees with `status='pending'`; call `insertNotification` for each invitee with `type='circle_invite'`, `category='Circles'`
    - _Requirements: 5.4, 5.5, 5.6_

  - [ ]* 14.9 Write property test for invite notifications sent to all invitees
    - **Property 24: Invite notifications sent to all invitees**
    - **Validates: Requirements 5.5**

- [x] 15. Circle rules and membership service
  - [x] 15.1 Implement the pending-to-active state transition in the membership acceptance handler (in `/api/communities.js` or a new `/api/memberships.js`): when the 2nd invitee (3rd member total) accepts, set `communities.status='active'` and creator's `memberships.rank_level=3`
    - _Requirements: 5.6, 6.3_

  - [ ]* 15.2 Write property test for circle pending-to-active state machine
    - **Property 25: Circle pending-to-active state machine**
    - **Validates: Requirements 5.6**

  - [ ]* 15.3 Write property test for creator rank promotion on activation
    - **Property 28: Creator rank promotion on activation**
    - **Validates: Requirements 6.3**

  - [x] 15.4 Implement leader succession logic: when a leader (rank_level=3) leaves or is banned from an active circle, promote the oldest co-leader (rank_level=2); if none, promote the longest-standing active member
    - _Requirements: 6.4_

  - [ ]* 15.5 Write property test for leader succession on departure
    - **Property 29: Leader succession on departure**
    - **Validates: Requirements 6.4**

  - [x] 15.6 Implement pending circle auto-dissolve: when the leader of a pending circle leaves or is banned, delete the circle, cancel all outstanding invite memberships, and call `insertNotification` for each invitee with `type='circle_dissolved'`, `category='Circles'`
    - _Requirements: 6.5_

  - [ ]* 15.7 Write property test for pending circle auto-dissolve on leader departure
    - **Property 30: Pending circle auto-dissolves on leader departure**
    - **Validates: Requirements 6.5**

  - [x] 15.8 Add pending circle cancellation UI for the creator in `UserPortal.jsx` (visible only on pending circles the user created); on confirm, call delete endpoint and notify invitees
    - _Requirements: 5.8_

  - [ ]* 15.9 Write property test for circle cancellation cleaning up all records
    - **Property 26: Circle cancellation cleans up all records**
    - **Validates: Requirements 5.8**

  - [ ]* 15.10 Write property test for active circle status being permanent
    - **Property 27: Active circle status is permanent**
    - **Validates: Requirements 6.1**

  - [x] 15.11 Add pending-circle warning badge to the Circles nav item in `AdminDashboard.jsx`: show badge with count when at least one circle has `status='pending'`, hide when zero
    - _Requirements: 6.8_

  - [ ]* 15.12 Write property test for admin badge showing for pending circles
    - **Property 32: Admin badge shows for pending circles**
    - **Validates: Requirements 6.8**

- [x] 16. Privacy and profile settings
  - [x] 16.1 Add "Appear in Discover" toggle to profile settings in `UserPortal.jsx`, reading and writing `account_details.discoverable`
    - _Requirements: 4.12_

  - [ ]* 16.2 Write property test for discoverable toggle round-trip
    - **Property 19: Discoverable toggle round-trip**
    - **Validates: Requirements 4.12**

  - [x] 16.3 Display connection count on user profiles (own and others) by counting accepted connections from the `connections` table
    - _Requirements: 4.7_

  - [ ]* 16.4 Write property test for connection count reflecting accepted connections
    - **Property 16: Connection count reflects accepted connections**
    - **Validates: Requirements 4.7**

  - [x] 16.5 Display connections list on the viewing user's own profile section in `UserPortal.jsx`
    - _Requirements: 4.8_

- [x] 17. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Install test dependencies and wire test suite
  - Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `fast-check` to `capstone-react/package.json` dev dependencies with pinned versions from the design
  - Configure Vitest in `vite.config.js` with `jsdom` environment and `setupFiles` pointing to a setup file that imports `@testing-library/jest-dom`
  - Create `capstone-react/src/__tests__/` directory structure with stub test files: `gender.test.js`, `onboarding-gate.test.js`, `discover.test.js`, `connections.test.js`, `circle-creation.test.js`, `notifications.test.js`, `login-streak.test.js`, `youtube-embed.test.js`
  - _Requirements: (testing infrastructure for all requirements)_

- [x] 19. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per property
- The `insertNotification()` helper (Task 11.3) must be in place before Tasks 14.8 and 15.6 to ensure grouping and muting work across all notification call sites
- The `CATEGORY_INTEREST_MAP` constant (Task 2.1) is shared between the Circle Creation form and the test suite — import from `src/lib/constants.js` in both places
- All new API routes follow the existing pattern: read `Authorization: Bearer <token>` header, use `supabaseAdmin` for writes, return JSON
