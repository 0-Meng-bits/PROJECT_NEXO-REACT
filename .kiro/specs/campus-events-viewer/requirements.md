# Campus Events Viewer - Requirements

## Overview
Add a personalized events view to the UserPortal that displays campus-wide events and circle-specific events, accessible via the navigation clock/date element. This completes the poll-to-event conversion feature by providing visibility into created events while respecting circle privacy.

## User Stories

### As a student
- I want to see upcoming campus-wide events (enrollment dates, university festivals, etc.)
- I want to see events from my circles only (study group meetups, club activities)
- I should NOT see other circles' private events
- I want quick access to events by clicking the date/time in the navigation

### As a circle member
- When my circle's poll converts to an event, I want to see that event in the events viewer
- I should only see events from circles I'm an approved member of
- Events from circles I'm not in should remain private

### As an admin
- I want to create campus-wide events that all students can see
- Campus-wide events should be clearly distinguished from circle events

## Functional Requirements

### FR1: Database Schema
**Add `community_id` to `campus_events` table**
- Column: `community_id uuid` nullable, foreign key to `communities(id)` with ON DELETE CASCADE
- When `community_id IS NULL`: Event is campus-wide (admin-created only)
- When `community_id IS NOT NULL`: Event is circle-specific (from polls)
- Index on `(community_id, start_date)` for query performance

### FR2: Row-Level Security (Privacy Enforcement)
**RLS policies must enforce privacy at the database level, not just UI filtering**

**SELECT Policy:**
```sql
Users can see:
- Campus-wide events (community_id IS NULL)
- OR events from circles they are approved members of
```

**INSERT Policy:**
```sql
- No direct inserts from frontend (WITH CHECK false)
- All inserts through backend API (service role)
```

**UPDATE Policy:**
```sql
- None (backend only)
- No frontend code updates campus_events
- Backend uses service role (bypasses RLS)
```

**DELETE Policy:**
```sql
- Only through backend API (service role)
- Enforced in backend logic (admin auth check)
```

**Policy Names to Drop (from existing migrations):**
- `"Anyone can read events"` (SELECT, permissive)
- `"Verified users can post events"` (INSERT, permissive)
- `"Admin and faculty can manage events"` (**FOR ALL**, permissive - **CRITICAL to drop**)
- `"Poster can delete own events"` (DELETE, permissive)

**CRITICAL:** 
1. Frontend talks directly to Supabase. Without RLS, anyone can read all circle events from browser console. RLS is non-negotiable for privacy.
2. The `FOR ALL USING (true)` policy combines with OR and silently defeats privacy if not dropped.
3. **Evidence:** Verified no frontend code directly inserts/updates campus_events:
   - Searched: `capstone-react/**/*.{jsx,js}` for `campus_events` insert/update operations
   - Result: **Zero matches**. AdminDashboard uses backend API only (`action: 'add_event'`, `action: 'delete_event'`)
   - Safe to lock down with `WITH CHECK (false)` and `USING (false)` policies

### FR3: Backend Updates

**Poll-to-Event (close-poll endpoint):**
- When creating event from poll, set `community_id` to the poll's `community_id`
- Event becomes visible only to that circle's members
- Already uses service role (bypasses RLS) ✓
- Already validates leader permissions ✓

**Admin Events (admin-data endpoint):**
- Continue creating events with `community_id = NULL` (campus-wide)
- Already uses service role ✓

### FR4: Events Viewer UI

**Location:**
- Clickable date/time element in top navigation bar
- Opens modal overlay (non-blocking, dismissible)

**Display Sections:**
1. **Campus-Wide Events**
   - Shows events where `community_id IS NULL`
   - Label: "Campus Events" or "Official Events"
   - All students see these

2. **Your Circle Events**
   - Shows events where `community_id` matches user's approved memberships
   - Label: "Your Circles" or "Circle Events"
   - **Query strategy:** Frontend queries all upcoming events; RLS automatically filters by membership
   - No manual membership filtering needed in UI (RLS enforces privacy at database level)
   - Personalized per user
   - Empty state: "No upcoming circle events"

**Event Card Display:**
- Title
- Date and time (formatted)
- Location (if provided)
- Category badge (color-coded)
- Circle name (for circle events only)

**Filtering & Sorting:**
- Show only upcoming events: `start_date >= today`
- Sort by: `start_date ASC, start_time ASC`
- Limit: 50 events (pagination if needed later)
- RLS checks: `memberships.status = 'approved'` (not pending/kicked)

**Empty States:**
- No campus events: "No upcoming campus events"
- No circle events: "No upcoming events from your circles"
- Not in any circles: "Join circles to see their events"

**Kicked/Removed Member Behavior:**
- If a user is kicked/removed from a circle, they lose access instantly (RLS enforces)
- Old notifications may still link to the event → user sees nothing (expected behavior, not a bug)
- No error message, just empty/filtered results

### FR5: Data Migration

**Migration must:**
1. Add `community_id` column to `campus_events`
2. Drop ALL existing permissive RLS policies by exact name (listed in FR2)
3. Create new restrictive policies (SELECT, INSERT, UPDATE, DELETE)
4. Add index on `(community_id, start_date)`

**Existing data:**
- All current rows have `community_id = NULL` (becomes campus-wide)
- Current seed data is academic calendar (legitimately campus-wide)
- No backfill needed

**Sanity Check:**
- Poll's `generated_event_id` references campus_events
- Poll has `community_id` → both deleted when community deleted (no dangling references)
- `ON DELETE CASCADE` is consistent across the system ✓

### FR6: Documentation Updates

**Poll-to-Event Design Doc:**
- Update **Requirement 4** (not "FR4"): "Set `community_id` to the poll's `community_id`"
- Update backend implementation: Show `community_id` in INSERT
- Update notification: Link to events viewer (not just community)
- Remove mentions of "leader-created events" (out of scope for v1)

**Database Schema Doc:**
- Add `community_id` to `campus_events` schema
- Document privacy model (NULL = campus-wide, NOT NULL = circle-specific)

## Non-Functional Requirements

### NFR1: Performance
- Modal loads in <500ms
- Query uses index on `(community_id, start_date)`
- Limit 50 events to prevent large payloads

### NFR2: Privacy
- RLS enforces privacy at database level
- No way for frontend to bypass circle event privacy
- Memberships must be `status = 'approved'`
- Pending and kicked members cannot see circle events

### NFR3: User Experience
- Modal is non-blocking (click outside to close)
- Responsive on mobile
- Clear visual distinction between campus-wide and circle events
- Empty states are helpful, not confusing

## Scope Limitations (v1)

**IN SCOPE:**
- Display events (read-only)
- Poll-generated circle events
- Admin-created campus events
- Privacy enforcement via RLS

**OUT OF SCOPE (Future):**
- Leader manually creating circle events (separate CRUD flow)
- Editing/deleting events from frontend
- RSVP/attendance tracking
- Event reminders/notifications
- Calendar grid view (monthly layout)
- Export to personal calendar (.ics)
- Event details page (dedicated route)

## Acceptance Criteria

1. ✅ `community_id` column exists in `campus_events` with proper FK and index
2. ✅ RLS policies prevent unauthorized access to circle events
3. ✅ Cannot read other circles' events via browser console/Supabase client (explicit privacy test)
4. ✅ Pending members cannot see circle events
5. ✅ Kicked members cannot see circle events
6. ✅ Poll-to-event creates events with correct `community_id`
7. ✅ Admin-created events have `community_id = NULL`
8. ✅ Clicking nav clock/date opens events modal
9. ✅ Modal shows campus-wide events to all users
10. ✅ Modal shows circle events only from user's approved memberships
11. ✅ Only upcoming events are shown (`start_date >= today`)
12. ✅ Empty states are clear and helpful
13. ✅ Modal is responsive and dismissible

## Dependencies

- Poll-to-Event feature (must update backend)
- Existing admin event creation flow (minor update)
- UserPortal navigation bar (add click handler)

## Risk Assessment

**Risk 1: Breaking Existing Events**
- **Evidence:** Verified no frontend code directly inserts to `campus_events`
  - Searched `capstone-react/**/*.{jsx,js}` for campus_events insert/update
  - AdminDashboard uses backend API only: `POST /api/admin-data` with `action: 'add_event'`
  - Safe to lock down with restrictive RLS policies
- **Mitigation:** All inserts go through backend API (service role bypasses RLS)

**Risk 2: Conflicting RLS Policies**
- **Mitigation:** Migration explicitly drops old permissive policies by exact name (listed in FR2)
- New policies are tested for privacy violations (see Explicit Privacy Test in tasks)

**Risk 3: Faculty Role Confusion**
- **Issue:** Old policy had "Admin and faculty can manage events" but faculty role isn't consistently defined
- **Decision:** Remove faculty from event management (admin only)
- **Future:** If faculty needs event creation, add proper role-based backend validation

## Open Questions

1. **Should `is_official` flag be kept?**
   - Currently: `is_official = true` for admin-created events
   - With `community_id`: NULL = campus-wide, NOT NULL = circle
   - **Decision:** Keep both. `is_official` can mark official vs unofficial campus-wide events
   - Example: Student org hosting campus-wide event (community_id = NULL, is_official = false)

2. **Event categories - should circles have custom categories?**
   - Current: Fixed categories (academic, social, etc.)
   - **Decision:** Keep fixed categories for v1. Custom categories = future enhancement.

3. **What happens when a circle is deleted?**
   - `ON DELETE CASCADE` on `community_id` FK
   - Events are deleted when circle is deleted
   - Poll with `generated_event_id` also deleted (both have `community_id`)
   - **Decision:** This is correct behavior (circle is gone, events don't make sense)

## Success Metrics (Measurable)

- **Zero unauthorized access** to circle events (security audit - browser console test)
- **Modal load time <500ms** (performance test with 50 events)
