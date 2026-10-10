# Requirements Document

## Introduction

This document specifies the requirements for nine new features on the NEXO Connect platform — a community interaction system for students and faculty at Cebu Technological University - Danao-Barangan Campus. The features address four research questions (RQ1.2, RQ2.2, RQ3.2, RQ5.3) of the capstone study: gender demographics, peer connectivity, interest-based community management, and engagement metrics. The platform is built on React/Vite (frontend), Node.js/Express serverless functions (backend), Supabase PostgreSQL with Row Level Security, and Supabase Auth with JWT tokens.

## Glossary

- **System**: The NEXO Connect platform as a whole.
- **Auth_Service**: The authentication module handling signup, login, and session management (`/api/signup`, `/api/login`, Supabase Auth).
- **Onboarding_Flow**: The three-step onboarding wizard shown to newly verified users (`Onboarding.jsx`).
- **Account_Details**: The `account_details` table storing profile and preference data per user.
- **Account_Status**: The `account_status` table storing trust, ban, suspension, and onboarding state per user.
- **Discover_Page**: The new "Discover People" tab in the main navigation of the User Portal.
- **Connection**: A bidirectional link between two verified users, established when both accept a connection request.
- **Connection_Service**: The backend API endpoints and Supabase logic governing connection requests, acceptance, decline, removal, and blocking.
- **Connections_Table**: The new `connections` database table (user_id, connected_user_id, status, created_at, updated_at).
- **Blocks_Table**: The new `blocks` database table (blocker_id, blocked_id, created_at).
- **Circle**: A student community group stored in the `communities` table.
- **Circle_Creation_Form**: The UI form through which a verified user creates a new Circle.
- **Circle_Status**: The `status` column on `communities` — values: `active`, `pending`.
- **Membership_Service**: The backend logic and Supabase queries governing Circle membership, invites, rank promotion, and removal.
- **Notification_Service**: The Supabase-backed notification system writing to and reading from the `notifications` table, including real-time subscriptions.
- **Login_Streak_Service**: The backend service tracking daily login streaks and awarding trust points, backed by the `login_streaks` table.
- **Login_Streaks_Table**: The new `login_streaks` database table (user_id, streak_count, last_login_date, longest_streak).
- **Trust_Points**: The integer score in `account_status.trust_points` representing a user's standing on the platform (max 10).
- **Portal_Header**: The persistent top navigation bar visible to logged-in users in the User Portal.
- **Help_Modal**: The existing `HelpModal.jsx` component accessible from the User Portal.
- **Landing_Page**: The public-facing `Landing.jsx` component shown to unauthenticated visitors.
- **Admin_Dashboard**: The `AdminDashboard.jsx` component and its associated backend, accessible only to Admin users.
- **Verified_User**: A user whose `account_status.is_verified` is `true`.
- **Interest**: One of the predefined interest strings (e.g., `coding`, `design`, `gaming`) stored as a text array in `account_details.interests`.
- **Category**: The top-level grouping of a Circle — one of: `Academic`, `Hobby`, `Social`, `Project`.
- **Interest_Tag**: A per-Circle tag drawn from the interests that map to the Circle's Category, stored in `communities.interest_tag`.
- **Open_Circle**: A Circle with `communities.is_open = true`, visible on the Discover Page for non-member applications.
- **Pending_Circle**: A Circle with `communities.status = 'pending'` — created but not yet at 3 accepted members.
- **Grace_Period**: A 2-consecutive-day window during which a missed login does not break a user's streak.

---

## Requirements

### Requirement 1: Gender Field at Signup

**User Story:** As a researcher, I want gender data collected at account creation, so that I can perform sex-based demographic analysis (RQ1.2) without requiring users to re-enter the information later.

#### Acceptance Criteria

1. THE `Account_Details` table SHALL include a `gender` column of type text, accepting exactly the values `Male`, `Female`, or `Prefer not to say`.
2. WHEN a user submits the Create Account form, THE `Auth_Service` SHALL persist the selected `gender` value to `Account_Details` for that user.
3. THE `Auth_Service` SHALL require a `gender` selection before the Create Account form can be submitted (the field is mandatory).
4. WHEN a user completes the `Onboarding_Flow` or views their profile, THE System SHALL NOT display the `gender` value in any UI element unless a future requirement explicitly enables it.
5. IF the `gender` value supplied during signup is not one of `Male`, `Female`, or `Prefer not to say`, THEN THE `Auth_Service` SHALL reject the request and return a descriptive validation error.

---

### Requirement 2: Onboarding Interest Selection Gate

**User Story:** As a platform designer, I want the "ENTER NEXO" button on Onboarding Step 3 to be locked until at least one interest is chosen, so that every user has at least one interest set before entering the portal.

#### Acceptance Criteria

1. WHILE a user is on Onboarding Step 3 and zero interests are selected, THE `Onboarding_Flow` SHALL keep the "ENTER NEXO" button in a disabled state.
2. WHEN a user selects at least one interest on Onboarding Step 3, THE `Onboarding_Flow` SHALL enable the "ENTER NEXO" button.
3. WHEN a user deselects all previously selected interests on Onboarding Step 3, THE `Onboarding_Flow` SHALL immediately return the "ENTER NEXO" button to a disabled state.
4. THE System SHALL allow a `Verified_User` to update or add interests from their profile settings after completing onboarding.

---

### Requirement 3: Discover People Page

**User Story:** As a verified student, I want a Discover People page, so that I can find and connect with other students who share my interests.

#### Acceptance Criteria

1. THE `Discover_Page` SHALL be accessible as a main navigation tab in the User Portal, placed adjacent to the Campus Events tab.
2. THE `Discover_Page` SHALL display only `Verified_User` accounts that have at least one `Interest` set in `Account_Details`.
3. WHERE a user has set `account_details.discoverable = false`, THE `Discover_Page` SHALL exclude that user from all listings.
4. THE `Discover_Page` SHALL provide two views: an "All" view grouping users by shared `Interest`, and a "Suggested" view ordering users whose interests overlap with the viewer's own interests first.
5. THE `Discover_Page` SHALL provide a filter control allowing the viewer to narrow the user list to a specific `Interest`.
6. WHEN displaying a user card on the `Discover_Page`, THE System SHALL show that user's full name, interests, course, and current connection status relative to the viewer.
7. WHEN a viewer clicks a user card on the `Discover_Page`, THE System SHALL open that user's profile.
8. THE `Discover_Page` SHALL display `Open_Circle` entries (Circles with `is_open = true`) alongside user cards.
9. WHEN the viewer has at least one `Connection` who is a member of an `Open_Circle`, THE `Discover_Page` SHALL visually highlight or prioritize that Circle's entry.
10. THE `Discover_Page` SHALL display a Connect button on each user card for users the viewer has not yet connected with and has not blocked.

---

### Requirement 4: Connection System

**User Story:** As a verified student, I want to connect with other students, so that I can build a trusted network required for creating Circles and receiving priority visibility on the Discover page.

#### Acceptance Criteria

1. WHEN a viewer clicks the Connect button on a user card or profile, THE `Connection_Service` SHALL create a connection request record in `Connections_Table` with status `pending`.
2. WHEN a connection request is created, THE `Notification_Service` SHALL deliver a notification to the recipient user.
3. WHEN the recipient accepts a connection request, THE `Connection_Service` SHALL update the record status to `accepted` and THE `Notification_Service` SHALL notify the requester.
4. WHEN the recipient declines a connection request, THE `Connection_Service` SHALL update the record status to `declined`.
5. THE `Connection_Service` SHALL enforce that only one pending request between the same two users exists at any time.
6. WHEN a connection request has been declined and fewer than 7 days have elapsed since the decline, THE `Connection_Service` SHALL reject any new request from the same requester to the same recipient and return an appropriate error.
7. THE System SHALL display each user's connection count on their profile.
8. THE System SHALL display a connections list on the viewing user's own profile.
9. WHEN a `Verified_User` removes a connection, THE `Connection_Service` SHALL delete the connection record and SHALL NOT alter any existing shared Circle memberships for either user.
10. WHEN a user blocks another user, THE `Connection_Service` SHALL record the relationship in `Blocks_Table`, remove any existing connection between them, and prevent the blocked user from sending connection requests to or appearing on the `Discover_Page` of the blocker.
11. THE `Admin_Dashboard` SHALL be able to read block relationships between users.
12. THE System SHALL provide a "Appear in Discover" privacy toggle in profile settings, stored as `account_details.discoverable` (default `true`).

---

### Requirement 5: Updated Circle Creation

**User Story:** As a verified student with connections, I want to create a Circle using my connections as founding members, so that new communities start with an established trust network.

#### Acceptance Criteria

1. WHEN a `Verified_User` who has fewer than 2 mutual `Connection` records attempts to open the `Circle_Creation_Form`, THE System SHALL display the message "You need 2 connections to create a circle" and SHALL NOT open the form.
2. THE `Circle_Creation_Form` SHALL include an `Interest_Tag` field filtered to interests that map to the chosen `Category` according to the following mapping:
   - `Academic`: Research, Debate, Business, Language Learning, Robotics, Reading
   - `Hobby`: Coding, Design, Gaming, Music, Art, Photography, Writing, Cooking, Anime, Fitness, Podcasting, E-Sports, Dancing, Watching BL/GL
   - `Social`: Sports, Travel, Fitness, Dancing, E-Sports
   - `Project`: Coding, Robotics, Design, Business, Research
3. THE `Circle_Creation_Form` SHALL include an "Open for Applications" toggle that sets `communities.is_open`.
4. WHEN a user submits the `Circle_Creation_Form`, THE `Membership_Service` SHALL restrict the initial invite list to users from the creator's connections list only.
5. WHEN a Circle is created, THE `Notification_Service` SHALL send an invite notification to each invited connection.
6. THE `Membership_Service` SHALL set `communities.status` to `pending` upon creation and change it to `active` only when 3 members (creator plus 2 invitees) have accepted.
7. WHEN all outstanding invites for a `Pending_Circle` have been declined and no accepted members remain beyond the creator, THE System SHALL allow the creator to either cancel the Circle or invite different connections.
8. IF the creator cancels a `Pending_Circle`, THEN THE `Membership_Service` SHALL delete the Circle, cancel all outstanding invites, and THE `Notification_Service` SHALL notify all invitees of the cancellation.

---

### Requirement 6: Circle Rules Update

**User Story:** As a Circle creator, I want the circle activation and leadership rules to be clearly defined, so that my circle behaves predictably during creation and after membership changes.

#### Acceptance Criteria

1. THE `Membership_Service` SHALL apply the minimum-3-members rule only at Circle creation (the `pending` state); once a Circle transitions to `active`, THE System SHALL keep it active regardless of subsequent member count changes.
2. THE System SHALL treat all Circles created before this requirement takes effect as grandfathered — their status SHALL NOT be changed retroactively.
3. WHEN a Circle transitions to `active`, THE `Membership_Service` SHALL automatically assign the creator a `rank_level` of 3 (Leader).
4. WHEN the Leader of an `active` Circle leaves or is banned, THE `Membership_Service` SHALL promote the oldest co-leader (rank_level 2) to Leader; IF no co-leader exists, THE `Membership_Service` SHALL promote the longest-standing active member.
5. WHEN the Leader of a `Pending_Circle` leaves or is banned before the Circle reaches `active`, THE `Membership_Service` SHALL auto-dissolve the Circle, cancel all outstanding invites, and THE `Notification_Service` SHALL notify all invitees of the dissolution.
6. WHEN `communities.is_open` is `true`, THE `Discover_Page` SHALL display the Circle as an `Open_Circle` available for applications.
7. WHEN `communities.is_open` is `false`, THE System SHALL restrict Circle membership to invited members only.
8. THE `Admin_Dashboard` SHALL display a warning badge on the sidebar navigation item for Circles whenever at least one Circle has `communities.status = 'pending'`.

---

### Requirement 7: Notification Improvements

**User Story:** As a user, I want my notifications to be grouped and categorizable, so that I can manage them without being overwhelmed by individual alerts.

#### Acceptance Criteria

1. WHEN multiple notifications of the same type are generated for the same user within a short time window, THE `Notification_Service` SHALL group them into a single notification with a summary count (e.g., "3 people accepted your connection request").
2. THE `Notification_Service` SHALL categorize each notification into one of three categories: `Connections`, `Circles`, or `Campus`.
3. THE System SHALL allow a user to mute any of the three notification categories from their profile settings; WHILE a category is muted, THE `Notification_Service` SHALL suppress new notifications of that category for that user.
4. WHEN a pending connection request has not been acted on for 30 days, THE `Connection_Service` SHALL automatically remove that request from `Connections_Table` and THE `Notification_Service` SHALL suppress its associated notification.

---

### Requirement 8: Daily Login Streak

**User Story:** As a student, I want to earn trust points by logging in daily, so that I can recover trust points lost from warnings and maintain good standing on the platform.

#### Acceptance Criteria

1. WHEN a `Verified_User` logs in and their `Login_Streaks_Table` record shows the last login was on the preceding calendar day, THE `Login_Streak_Service` SHALL increment `streak_count` by 1.
2. WHEN a `Verified_User` logs in for the first time or after a streak reset, THE `Login_Streak_Service` SHALL set `streak_count` to 1.
3. THE `Login_Streak_Service` SHALL award trust points per login according to the following schedule: Day 1 = +1 TP, Day 2 = +2 TP, Day 3 = +3 TP, Day 4 = +4 TP, Day 5 and beyond = +5 TP per day.
4. THE `Login_Streak_Service` SHALL cap `account_status.trust_points` at a maximum of 10; no login shall cause the value to exceed 10.
5. WHEN a `Verified_User` misses up to 2 consecutive calendar days, THE `Login_Streak_Service` SHALL preserve the existing `streak_count` (grace period) and SHALL NOT reset it.
6. WHEN a `Verified_User` misses more than 2 consecutive calendar days, THE `Login_Streak_Service` SHALL reset `streak_count` to 0.
7. WHEN trust points are awarded on login, THE System SHALL display a toast notification showing the flame icon, current streak day, and points awarded (e.g., "🔥 Day 3 Streak! +3 Trust Points").
8. THE `Portal_Header` SHALL display a flame icon with the current `streak_count` value for the logged-in user.
9. THE System SHALL display the current `streak_count` alongside the trust points badge in the user's profile modal.
10. THE `Login_Streaks_Table` SHALL store `user_id`, `streak_count`, `last_login_date`, and `longest_streak` for each user.

---

### Requirement 9: YouTube Tutorial Video Embed

**User Story:** As a new visitor or student, I want to watch a tutorial or promotional video about NEXO Connect, so that I can understand how to use the platform before or during onboarding.

#### Acceptance Criteria

1. THE `Landing_Page` SHALL embed the NEXO Connect YouTube tutorial video using an iframe with the YouTube embed URL.
2. THE `Help_Modal` SHALL embed the same YouTube tutorial video using an iframe with the YouTube embed URL.
3. THE `Onboarding_Flow` SHALL display the YouTube tutorial video on Step 1 (the Profile Picture step) using an iframe with the YouTube embed URL.
4. WHEN the YouTube embed URL is updated in the codebase, THE System SHALL reflect the change across all three embed locations (`Landing_Page`, `Help_Modal`, `Onboarding_Flow`) without requiring separate updates to each component.

---

### Requirement 10: Database Schema Changes

**User Story:** As a developer, I want the database to support all new features with proper tables and columns, so that data integrity and Row Level Security are maintained throughout.

#### Acceptance Criteria

1. THE System SHALL add a `connections` table to the Supabase database with columns: `id` (uuid, primary key), `user_id` (uuid, references accounts), `connected_user_id` (uuid, references accounts), `status` (text: `pending`/`accepted`/`declined`), `created_at` (timestamptz), `updated_at` (timestamptz).
2. THE System SHALL add a `blocks` table with columns: `id` (uuid, primary key), `blocker_id` (uuid, references accounts), `blocked_id` (uuid, references accounts), `created_at` (timestamptz).
3. THE System SHALL add a `login_streaks` table with columns: `user_id` (uuid, primary key, references accounts), `streak_count` (int, default 0), `last_login_date` (date), `longest_streak` (int, default 0).
4. THE System SHALL add a `gender` column (text) and a `discoverable` column (boolean, default true) to the `account_details` table.
5. THE System SHALL add an `interest_tag` column (text), an `is_open` column (boolean, default false), and a `status` column (text, default `active`) to the `communities` table.
6. THE System SHALL enforce Row Level Security policies on `connections` and `blocks` tables such that users can only read and write their own records, and Admin users retain full read access.
