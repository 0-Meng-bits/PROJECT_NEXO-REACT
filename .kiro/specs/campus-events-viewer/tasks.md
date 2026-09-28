# Campus Events Viewer - Implementation Tasks

## Phase 1: Database Migration

### Task 1.1: Create Migration File
**File:** `supabase/migrations/20260928120000_add_community_id_to_campus_events.sql`

**Steps:**
1. Create migration file with proper timestamp
2. Add `community_id` column to `campus_events`
3. Add foreign key constraint with `ON DELETE CASCADE`
4. Create index on `(community_id, start_date)`
5. Drop ALL old RLS policies by name
6. Create new restrictive RLS policies (SELECT, INSERT, DELETE)

**Acceptance:**
- [ ] Migration file created with correct SQL
- [ ] Column added with proper FK constraint
- [ ] Index created for query performance
- [ ] Old policies dropped to prevent conflicts
- [ ] New policies enforce privacy correctly

**SQL Template:**
```sql
-- Add community_id column
ALTER TABLE campus_events 
ADD COLUMN community_id uuid REFERENCES communities(id) ON DELETE CASCADE;

-- Add index
CREATE INDEX idx_campus_events_community_date 
ON campus_events(community_id, start_date);

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can read events" ON campus_events;
DROP POLICY IF EXISTS "Verified users can post events" ON campus_events;
DROP POLICY IF EXISTS "Admin and faculty can manage events" ON campus_events;
DROP POLICY IF EXISTS "Poster can delete own events" ON campus_events;

-- New SELECT policy
CREATE POLICY "Users see campus-wide or their circle events"
ON campus_events FOR SELECT
USING (
  community_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.community_id = campus_events.community_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'approved'
  )
);

-- New INSERT policy
CREATE POLICY "No direct inserts from frontend"
ON campus_events FOR INSERT
WITH CHECK (false);

-- New DELETE policy
CREATE POLICY "No direct deletes from frontend"
ON campus_events FOR DELETE
USING (false);
```

---

## Phase 2: Backend Updates

### Task 2.1: Update Poll-to-Event Backend
**File:** `capstone-system/server.js`

**Endpoint:** `POST /api/close-poll`

**Changes:**
1. Locate the `campus_events` INSERT statement
2. Add `community_id: announcement.community_id` to the insert object
3. Verify column names match database (event_date vs start_date)
4. Test: Close poll → verify event has correct community_id

**Before:**
```javascript
const { data: event, error: eventError } = await supabase
  .from('campus_events')
  .insert([{
    title: winningOption,
    description: `Event created from poll: "${announcement.title}"`,
    event_date: eventMetadata.event_date,
    event_time: eventMetadata.event_time,
    location: eventMetadata.location || '',
    category: 'social',
    poster_id: closerId,
    poster_name: closer.full_name || closer.student_id,
    poster_type: closer.user_type || 'Student',
    is_official: false,
  }])
  .select('id')
  .single();
```

**After:**
```javascript
const { data: event, error: eventError } = await supabase
  .from('campus_events')
  .insert([{
    community_id: announcement.community_id,  // NEW
    title: winningOption,
    description: `Event created from poll: "${announcement.title}"`,
    event_date: eventMetadata.event_date,
    event_time: eventMetadata.event_time,
    location: eventMetadata.location || '',
    category: 'social',
    poster_id: closerId,
    poster_name: closer.full_name || closer.student_id,
    poster_type: closer.user_type || 'Student',
    is_official: false,
  }])
  .select('id')
  .single();
```

**Acceptance:**
- [ ] `community_id` added to INSERT statement
- [ ] Uses `announcement.community_id` (from poll's community)
- [ ] Backend deploys successfully to Render
- [ ] Test: Close poll creates event with correct community_id

---

### Task 2.2: Update Admin Event Creation
**File:** `capstone-system/server.js`

**Endpoint:** `POST /api/admin-data` (action: create_event)

**Changes:**
1. Locate admin event creation INSERT
2. Explicitly set `community_id: null`
3. Test: Admin creates event → verify community_id is NULL

**Before:**
```javascript
const { data, error } = await supabase
  .from('campus_events')
  .insert([{
    title: req.body.title,
    description: req.body.description || '',
    start_date: req.body.start_date,
    end_date: req.body.end_date || null,
    category: req.body.category || 'general',
    poster_id: adminId,
    poster_name: admin.full_name,
    poster_type: 'Admin',
    is_official: true,
  }])
  .select();
```

**After:**
```javascript
const { data, error } = await supabase
  .from('campus_events')
  .insert([{
    community_id: null,  // NEW: Explicitly campus-wide
    title: req.body.title,
    description: req.body.description || '',
    start_date: req.body.start_date,
    end_date: req.body.end_date || null,
    category: req.body.category || 'general',
    poster_id: adminId,
    poster_name: admin.full_name,
    poster_type: 'Admin',
    is_official: true,
  }])
  .select();
```

**Acceptance:**
- [ ] `community_id: null` added to INSERT
- [ ] Backend deploys successfully
- [ ] Test: Admin creates event → community_id is NULL in database

---

## Phase 3: Frontend - EventCard Component

### Task 3.1: Create EventCard Component
**File:** `capstone-react/src/components/EventCard.jsx` (new file)

**Component Props:**
```typescript
{
  event: {
    id: string,
    community_id: string | null,
    title: string,
    description: string,
    start_date: string,
    start_time: string,
    end_date: string,
    end_time: string,
    location: string,
    category: string,
    is_official: boolean,
    communities?: { id: string, name: string, category: string }
  },
  showCircleName: boolean
}
```

**Implementation:**
```javascript
import React from 'react';

export default function EventCard({ event, showCircleName = false }) {
  const categoryColors = {
    academic: '#3b82f6',
    social: '#ec4899',
    sports: '#10b981',
    cultural: '#f59e0b',
    general: '#6b7280',
  };
  
  const color = categoryColors[event.category] || categoryColors.general;
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString([], { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatTime = (time) => {
    if (!time) return '';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="event-card">
      <span 
        className="event-category-badge"
        style={{ 
          backgroundColor: `${color}20`,
          border: `1px solid ${color}`,
          color: color
        }}
      >
        {event.category}
      </span>
      
      {showCircleName && event.communities && (
        <div className="event-circle-name">
          <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 6 }}></i>
          {event.communities.name}
        </div>
      )}
      
      <h4 className="event-title">{event.title}</h4>
      
      <div className="event-details">
        <div className="event-detail-row">
          <i className="fa-solid fa-calendar"></i>
          <span>{formatDate(event.start_date)}</span>
        </div>
        
        {event.start_time && (
          <div className="event-detail-row">
            <i className="fa-solid fa-clock"></i>
            <span>{formatTime(event.start_time)}</span>
          </div>
        )}
        
        {event.location && (
          <div className="event-detail-row">
            <i className="fa-solid fa-location-dot"></i>
            <span>{event.location}</span>
          </div>
        )}
      </div>
      
      {event.description && (
        <p className="event-description">{event.description}</p>
      )}
    </div>
  );
}
```

**Acceptance:**
- [ ] Component file created
- [ ] Displays all event properties correctly
- [ ] Category badge color-coded
- [ ] Circle name shown when `showCircleName={true}`
- [ ] Dates/times formatted properly
- [ ] Description truncated if too long

---

## Phase 4: Frontend - Events Modal

### Task 4.1: Add State Management to UserPortal
**File:** `capstone-react/src/components/UserPortal.jsx`

**Add to imports:**
```javascript
import EventCard from './EventCard';
```

**Add to state:**
```javascript
const [showEventsModal, setShowEventsModal] = useState(false);
const [campusEvents, setCampusEvents] = useState([]);
const [circleEvents, setCircleEvents] = useState([]);
const [eventsLoading, setEventsLoading] = useState(false);
```

**Acceptance:**
- [ ] EventCard imported
- [ ] State variables added
- [ ] No TypeScript errors

---

### Task 4.2: Implement loadEvents Function
**File:** `capstone-react/src/components/UserPortal.jsx`

**Add function:**
```javascript
const loadEvents = useCallback(async () => {
  if (!user) return;
  setEventsLoading(true);
  
  const today = new Date().toISOString().split('T')[0];
  
  // Single query - RLS automatically filters by membership
  const { data, error } = await supabase
    .from('campus_events')
    .select(`
      id,
      community_id,
      title,
      description,
      start_date,
      start_time,
      end_date,
      end_time,
      location,
      category,
      is_official,
      communities:community_id (
        id,
        name,
        category
      )
    `)
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(50);
  
  if (!error && data) {
    // Separate campus-wide from circle events
    const campus = data.filter(e => e.community_id === null);
    const circles = data.filter(e => e.community_id !== null);
    
    setCampusEvents(campus);
    setCircleEvents(circles);
  } else if (error) {
    console.error('Failed to load events:', error);
  }
  
  setEventsLoading(false);
}, [user]);
```

**Acceptance:**
- [ ] Function queries `campus_events` with correct fields
- [ ] Only upcoming events (`start_date >= today`)
- [ ] Sorted by date then time
- [ ] Limited to 50 events
- [ ] Separates campus vs circle events
- [ ] Error handling included

---

### Task 4.3: Make Clock Clickable
**File:** `capstone-react/src/components/UserPortal.jsx`

**Find the clock element** (around line 4000):
```javascript
<div className="nav-clock">
```

**Update to:**
```javascript
<div 
  className="nav-clock" 
  onClick={() => {
    setShowEventsModal(true);
    loadEvents();
  }}
  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
  onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
  onMouseLeave={e => e.currentTarget.style.opacity = 1}
  title="View campus events"
>
```

**Acceptance:**
- [ ] Clock has `onClick` handler
- [ ] Opens modal and loads events
- [ ] Cursor changes to pointer on hover
- [ ] Opacity changes on hover
- [ ] Tooltip shows "View campus events"

---

### Task 4.4: Create Events Modal Overlay
**File:** `capstone-react/src/components/UserPortal.jsx`

**Add after the main content** (before closing `</div>` of UserPortal):
```javascript
{/* ── EVENTS MODAL ── */}
{showEventsModal && (
  <div className="modal-overlay" onClick={() => setShowEventsModal(false)}>
    <div className="events-modal" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="events-modal-header">
        <h2>
          <i className="fa-solid fa-calendar-days" style={{ marginRight: 10 }}></i>
          Campus Events
        </h2>
        <button onClick={() => setShowEventsModal(false)} className="modal-close-btn">
          &times;
        </button>
      </div>
      
      {/* Content */}
      <div className="events-modal-content">
        {eventsLoading ? (
          <div className="events-loading">
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
            Loading events...
          </div>
        ) : (
          <>
            {/* Campus-Wide Events Section */}
            <div className="events-section">
              <h3 className="events-section-title">
                <i className="fa-solid fa-university"></i> Campus-Wide
              </h3>
              {campusEvents.length === 0 ? (
                <div className="events-empty">No upcoming campus events</div>
              ) : (
                <div className="events-list">
                  {campusEvents.map(event => (
                    <EventCard key={event.id} event={event} showCircleName={false} />
                  ))}
                </div>
              )}
            </div>
            
            {/* Circle Events Section */}
            <div className="events-section">
              <h3 className="events-section-title">
                <i className="fa-solid fa-users"></i> Your Circles
              </h3>
              {circleEvents.length === 0 ? (
                <div className="events-empty">
                  {communities.length === 0 
                    ? "Join circles to see their events"
                    : "No upcoming events from your circles"}
                </div>
              ) : (
                <div className="events-list">
                  {circleEvents.map(event => (
                    <EventCard key={event.id} event={event} showCircleName={true} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}
```

**Acceptance:**
- [ ] Modal renders when `showEventsModal` is true
- [ ] Clicking outside modal closes it
- [ ] Close button works
- [ ] Loading state shows spinner
- [ ] Campus events section displays correctly
- [ ] Circle events section displays correctly
- [ ] Empty states show appropriate messages
- [ ] EventCards render properly

---

## Phase 5: Frontend - Styling

### Task 5.1: Add Events Modal CSS
**File:** `capstone-react/src/index.css`

**Add at the end of the file:**
```css
/* ══════════════════════════════════════════════════════════ */
/* EVENTS MODAL */
/* ══════════════════════════════════════════════════════════ */

.events-modal {
  position: relative;
  background: var(--card-bg);
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.events-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 240, 255, 0.15);
}

.events-modal-header h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--cyber-cyan);
  margin: 0;
  display: flex;
  align-items: center;
}

.events-modal-content {
  overflow-y: auto;
  padding: 20px 24px;
  flex: 1;
}

/* Events Sections */
.events-section {
  margin-bottom: 24px;
}

.events-section:last-child {
  margin-bottom: 0;
}

.events-section-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.events-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.events-loading {
  padding: 40px;
  text-align: center;
  color: var(--cyber-cyan);
  font-size: 13px;
  letter-spacing: 1px;
}

/* Event Card */
.event-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: 10px;
  padding: 16px;
  transition: border-color 0.2s, transform 0.2s;
}

.event-card:hover {
  border-color: rgba(0, 240, 255, 0.3);
  transform: translateX(4px);
}

.event-category-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.event-circle-name {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
}

.event-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  line-height: 1.3;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.event-detail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

.event-detail-row i {
  width: 16px;
  text-align: center;
  color: var(--cyber-cyan);
  font-size: 11px;
}

.event-description {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 8px 0 0 0;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Responsive */
@media (max-width: 768px) {
  .events-modal {
    width: 95%;
    max-height: 90vh;
  }
  
  .events-modal-header {
    padding: 16px 18px;
  }
  
  .events-modal-header h2 {
    font-size: 16px;
  }
  
  .events-modal-content {
    padding: 16px 18px;
  }
  
  .event-card {
    padding: 14px;
  }
}
```

**Acceptance:**
- [ ] CSS added to index.css
- [ ] Modal styled correctly
- [ ] Event cards styled correctly
- [ ] Responsive on mobile
- [ ] Animations smooth
- [ ] Matches existing UserPortal theme

---

## Phase 6: Testing & Deployment

### Task 6.1: Test Database Migration
**Steps:**
1. Run migration in Supabase dashboard
2. Verify column exists: `SELECT * FROM campus_events LIMIT 1;`
3. Test SELECT as regular user (should see campus + their circles only)
4. Test SELECT in browser console (should be filtered by RLS)
5. Try INSERT from frontend (should fail - policy blocks)

**Acceptance:**
- [ ] Migration runs without errors
- [ ] `community_id` column exists
- [ ] Index created successfully
- [ ] Old policies dropped
- [ ] New policies enforce privacy
- [ ] Cannot bypass RLS from browser console

---

### Task 6.2: Test Backend Changes
**Steps:**
1. Deploy backend to Render
2. Test poll-to-event:
   - Create event poll in a circle
   - Close poll
   - Check database: event has correct `community_id`
3. Test admin event creation:
   - Create event via admin dashboard
   - Check database: event has `community_id = NULL`

**Acceptance:**
- [ ] Backend deploys successfully
- [ ] Poll-to-event creates circle events (community_id set)
- [ ] Admin creates campus events (community_id NULL)
- [ ] No errors in Render logs

---

### Task 6.3: Test Frontend Events Modal
**Steps:**
1. Deploy frontend to Vercel
2. Test as regular user:
   - Click clock/date in navigation
   - Modal should open
   - Should see campus events
   - Should see events from circles user is member of
   - Should NOT see events from other circles
3. Test empty states:
   - User with no circles → sees appropriate message
   - No upcoming events → sees appropriate message
4. Test responsiveness:
   - Open modal on mobile
   - Verify layout works
5. Test interactions:
   - Click outside modal → closes
   - Click close button → closes
   - Hover over clock → cursor changes

**Acceptance:**
- [ ] Frontend deploys successfully
- [ ] Clock is clickable
- [ ] Modal opens and loads events
- [ ] Campus events visible to all
- [ ] Circle events filtered correctly
- [ ] Cannot see other circles' events
- [ ] Empty states display correctly
- [ ] Responsive on mobile
- [ ] Modal closes correctly
- [ ] No console errors

---

### Task 6.4: Security Audit
**Steps:**
1. Open browser console as regular user
2. Try to query other circles' events directly:
```javascript
const { data } = await supabase
  .from('campus_events')
  .select('*')
  .eq('community_id', '<other_circle_id>');
console.log(data); // Should be empty
```
3. Try to insert event directly:
```javascript
const { data, error } = await supabase
  .from('campus_events')
  .insert([{ title: 'Test', community_id: null }]);
console.log(error); // Should fail with policy violation
```

**Acceptance:**
- [ ] Cannot read other circles' events via console
- [ ] Cannot insert events via console
- [ ] RLS blocks unauthorized access
- [ ] Privacy is enforced at database level

---

## Phase 7: Documentation

### Task 7.1: Update Poll-to-Event Design Doc
**File:** `.kiro/specs/poll-to-event-conversion/design.md`

**Changes:**
1. Update FR4: Add "Set `community_id` to poll's `community_id`"
2. Update backend code snippet to show `community_id` in INSERT
3. Update notification section: Link to events modal (not just community)
4. Remove "leader-created events" mentions (out of scope)

**Acceptance:**
- [ ] FR4 updated with `community_id` requirement
- [ ] Code snippets show `community_id` field
- [ ] Notification links updated
- [ ] Leader-created events removed from scope

---

### Task 7.2: Update Database Schema Doc
**File:** `DATABASE_SCHEMA.md`

**Add to campus_events section:**
```markdown
### campus_events
- community_id (uuid, nullable) - Foreign key to communities.id
  - NULL: Campus-wide event (visible to all students)
  - NOT NULL: Circle-specific event (visible to members only)
  - ON DELETE CASCADE: Event deleted when circle deleted
  - Privacy enforced via RLS (SELECT policy checks membership)
```

**Acceptance:**
- [ ] `community_id` documented in schema
- [ ] Privacy model explained (NULL vs NOT NULL)
- [ ] ON DELETE CASCADE documented
- [ ] RLS enforcement mentioned

---

### Task 7.3: Update GeneratedEventLink Message
**File:** `capstone-react/src/components/GeneratedEventLink.jsx`

**Current message for regular users:**
```javascript
alert(`Event created successfully!\n\nThis event has been added to the campus events database. Currently, campus events are managed through the Admin Dashboard.`);
```

**Updated message:**
```javascript
alert(`Event created successfully!\n\nClick the date/time in the navigation bar to view this event and other upcoming events from your circles.`);
```

**Acceptance:**
- [ ] Message updated to reference clock/date element
- [ ] Instructions clear and actionable
- [ ] No mention of "calendar" (since no calendar view exists)

---

## Phase 8: Final Verification

### Task 8.1: End-to-End Test
**Scenario:**
1. Circle leader creates event poll with event metadata
2. Members vote on poll options
3. Leader closes poll
4. Event is created in database
5. All circle members can see event in events modal
6. Non-members cannot see the event

**Steps:**
1. Create test circle with 2 users (A = leader, B = member)
2. User A creates event poll with date/time/location
3. User B votes on poll
4. User A closes poll
5. Verify: Event created with `community_id` = circle id
6. User A clicks clock → sees event in "Your Circles" section
7. User B clicks clock → sees event in "Your Circles" section
8. User C (not in circle) clicks clock → does NOT see the event
9. Admin clicks clock → sees event in "Your Circles" IF admin is member

**Acceptance:**
- [ ] Poll-to-event creates circle event successfully
- [ ] Circle members can see the event
- [ ] Non-members cannot see the event
- [ ] Event displays correct date/time/location
- [ ] Event shows circle name in UI

---

### Task 8.2: Admin Flow Test
**Scenario:**
1. Admin creates campus-wide event via admin dashboard
2. All students can see the event in events modal

**Steps:**
1. Login as admin
2. Navigate to Admin Dashboard → Campus Events
3. Create new event with title, description, date
4. Verify: Event created with `community_id = NULL`
5. Login as regular student
6. Click clock/date in navigation
7. See event in "Campus-Wide" section

**Acceptance:**
- [ ] Admin can create campus events
- [ ] Event has `community_id = NULL`
- [ ] All students see the event
- [ ] Event displays in "Campus-Wide" section

---

### Task 8.3: Mobile Responsiveness Test
**Steps:**
1. Open app on mobile device (or Chrome DevTools mobile view)
2. Click clock/date element
3. Modal opens full-width on mobile
4. Event cards are readable
5. Scrolling works smoothly
6. Close button accessible

**Acceptance:**
- [ ] Modal responsive on mobile
- [ ] Clock clickable on mobile
- [ ] Event cards display correctly
- [ ] Text is readable
- [ ] No horizontal scrolling
- [ ] Close button accessible

---

## Task Checklist Summary

**Phase 1: Database**
- [ ] 1.1 Create migration file

**Phase 2: Backend**
- [ ] 2.1 Update poll-to-event backend
- [ ] 2.2 Update admin event creation

**Phase 3: EventCard Component**
- [ ] 3.1 Create EventCard component

**Phase 4: Events Modal**
- [ ] 4.1 Add state management
- [ ] 4.2 Implement loadEvents function
- [ ] 4.3 Make clock clickable
- [ ] 4.4 Create events modal overlay

**Phase 5: Styling**
- [ ] 5.1 Add events modal CSS

**Phase 6: Testing**
- [ ] 6.1 Test database migration
- [ ] 6.2 Test backend changes
- [ ] 6.3 Test frontend events modal
- [ ] 6.4 Security audit

**Phase 7: Documentation**
- [ ] 7.1 Update poll-to-event design doc
- [ ] 7.2 Update database schema doc
- [ ] 7.3 Update GeneratedEventLink message

**Phase 8: Final Verification**
- [ ] 8.1 End-to-end test (circle events)
- [ ] 8.2 Admin flow test (campus events)
- [ ] 8.3 Mobile responsiveness test

---

## Estimated Time

- Phase 1: 15 minutes (migration)
- Phase 2: 20 minutes (backend updates)
- Phase 3: 20 minutes (EventCard component)
- Phase 4: 40 minutes (modal implementation)
- Phase 5: 15 minutes (CSS)
- Phase 6: 30 minutes (testing)
- Phase 7: 20 minutes (documentation)
- Phase 8: 30 minutes (verification)

**Total: ~3 hours**

---

## Dependencies

- Poll-to-Event feature must be functional
- Admin dashboard event creation must be functional
- UserPortal navigation bar must exist
- Supabase access for migration

---

## Risks & Mitigation

**Risk:** Migration breaks existing event queries
- **Mitigation:** Migration adds nullable column (doesn't break existing code)
- **Rollback:** Can drop column if needed

**Risk:** RLS policy too restrictive
- **Mitigation:** Test with multiple user types before production
- **Rollback:** Can update policy without data loss

**Risk:** Frontend performance with 50 events
- **Mitigation:** Events limited to 50, indexed queries
- **Monitor:** If slow, add pagination

**Risk:** User confusion about event visibility
- **Mitigation:** Clear section labels ("Campus-Wide" vs "Your Circles")
- **Improvement:** Add tooltips if needed
