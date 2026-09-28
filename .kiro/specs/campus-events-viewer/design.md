# Campus Events Viewer - Design Document

## System Architecture

### Component Overview
```
Navigation Clock (UserPortal)
    ↓ (click)
Events Modal Overlay
    ↓ (queries)
Supabase: campus_events table
    ↓ (RLS filters)
Returns: Campus-wide + User's Circle Events
```

### Data Flow

**Event Creation Paths:**
1. **Admin → Backend API → campus_events** (`community_id = NULL`)
2. **Poll Close → Backend API → campus_events** (`community_id = <circle_id>`)

**Event Display Path:**
1. **User clicks clock** → Opens modal
2. **Modal queries Supabase** → Direct client call
3. **RLS enforces privacy** → Filters by membership
4. **Returns filtered events** → Displays in two sections

---

## Database Design

### Schema Changes

**Migration: `20260928120000_add_community_id_to_campus_events.sql`**

```sql
-- Add community_id column
ALTER TABLE campus_events 
ADD COLUMN community_id uuid REFERENCES communities(id) ON DELETE CASCADE;

-- Add index for query performance
CREATE INDEX idx_campus_events_community_date 
ON campus_events(community_id, start_date);

-- Drop old permissive policies (CRITICAL: prevents policy conflicts)
DROP POLICY IF EXISTS "Anyone can read events" ON campus_events;
DROP POLICY IF EXISTS "Verified users can post events" ON campus_events;
DROP POLICY IF EXISTS "Admin and faculty can manage events" ON campus_events;
DROP POLICY IF EXISTS "Poster can delete own events" ON campus_events;

-- New SELECT policy: Privacy-enforced
CREATE POLICY "Users see campus-wide or their circle events"
ON campus_events FOR SELECT
USING (
  -- Campus-wide events (visible to all)
  community_id IS NULL
  OR
  -- Circle events (visible to approved members only)
  EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.community_id = campus_events.community_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'approved'
  )
);

-- New INSERT policy: Backend-only
CREATE POLICY "No direct inserts from frontend"
ON campus_events FOR INSERT
WITH CHECK (false);

-- New DELETE policy: Backend-only
CREATE POLICY "No direct deletes from frontend"
ON campus_events FOR DELETE
USING (false);

-- Note: All inserts/deletes go through backend API which uses service role (bypasses RLS)
-- Backend enforces admin/leader authorization before insert/delete
```

### Updated Schema

```sql
campus_events
├── id (uuid, PK)
├── community_id (uuid, FK → communities) [NEW]
├── poster_id (uuid, FK → accounts)
├── title (text)
├── description (text)
├── start_date (date)  -- Note: was event_date in old schema
├── start_time (time)  -- Note: was event_time in old schema
├── end_date (date)
├── end_time (time)
├── location (text)
├── category (text)
├── poster_name (text)
├── poster_type (text)
├── is_official (boolean)
└── created_at (timestamptz)
```

**Privacy Model:**
- `community_id IS NULL` → Campus-wide event (all users see it)
- `community_id IS NOT NULL` → Circle event (only members see it)

**Column Name Note:**
The poll-to-event backend uses `event_date` and `event_time` but admin dashboard uses `start_date` and `start_time`. Need to verify actual column names in production and standardize.

---

## Backend Changes

### 1. Poll-to-Event (close-poll endpoint)

**File:** `capstone-system/server.js`

**Current INSERT:**
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

**Updated INSERT (add community_id):**
```javascript
const { data: event, error: eventError } = await supabase
  .from('campus_events')
  .insert([{
    community_id: announcement.community_id,  // NEW: Circle-specific event
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

**Authorization:** Already validates leader status ✓

### 2. Admin Event Creation

**File:** `capstone-system/server.js` (admin-data endpoint)

**Current INSERT:**
```javascript
// Admin creates campus-wide events
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

**Updated (explicitly set community_id = null):**
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

---

## Frontend Implementation

### Component Structure

```
UserPortal.jsx
├── Navigation Bar
│   └── Clock/Date Element (clickable)
│       └── onClick → setShowEventsModal(true)
│
└── Events Modal Overlay (conditional render)
    ├── Modal Header ("Campus Events")
    ├── Campus-Wide Section
    │   └── EventCard[] (community_id IS NULL)
    ├── Your Circles Section
    │   └── EventCard[] (community_id in user's circles)
    └── Close Button
```

### State Management

```javascript
// UserPortal.jsx state additions
const [showEventsModal, setShowEventsModal] = useState(false);
const [campusEvents, setCampusEvents] = useState([]);
const [circleEvents, setCircleEvents] = useState([]);
const [eventsLoading, setEventsLoading] = useState(false);
```

### Data Fetching

```javascript
const loadEvents = async () => {
  if (!user) return;
  setEventsLoading(true);
  
  const today = new Date().toISOString().split('T')[0];
  
  // Query with RLS enforcing privacy
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
  }
  
  setEventsLoading(false);
};
```

**Note:** RLS automatically filters circle events to only those from user's approved memberships. No additional frontend filtering needed.

### UI Components

#### 1. Clickable Clock (Navigation Bar)

```javascript
<div 
  className="nav-clock" 
  onClick={() => setShowEventsModal(true)}
  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
  onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
  onMouseLeave={e => e.currentTarget.style.opacity = 1}
  title="View campus events"
>
  <span className="nav-clock-time">
    {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
  </span>
  <span className="nav-clock-date">
    {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
  </span>
</div>
```

#### 2. Events Modal Overlay

```javascript
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
          <div className="events-loading">Loading events...</div>
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
                    <EventCard key={event.id} event={event} />
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
                    <EventCard key={event.id} event={event} showCircleName />
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

#### 3. EventCard Component

```javascript
function EventCard({ event, showCircleName = false }) {
  const categoryColors = {
    academic: '#3b82f6',
    social: '#ec4899',
    sports: '#10b981',
    cultural: '#f59e0b',
    general: '#6b7280',
  };
  
  const color = categoryColors[event.category] || categoryColors.general;
  
  const formatDate = (date) => {
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
      {/* Category Badge */}
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
      
      {/* Circle Name (for circle events) */}
      {showCircleName && event.communities && (
        <div className="event-circle-name">
          <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 6 }}></i>
          {event.communities.name}
        </div>
      )}
      
      {/* Event Title */}
      <h4 className="event-title">{event.title}</h4>
      
      {/* Event Details */}
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
      
      {/* Event Description */}
      {event.description && (
        <p className="event-description">{event.description}</p>
      )}
    </div>
  );
}
```

### CSS Styling

**File:** `capstone-react/src/index.css`

```css
/* Events Modal */
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

.modal-close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.modal-close-btn:hover {
  color: var(--red);
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

/* Clickable Clock */
.nav-clock {
  cursor: pointer;
  user-select: none;
}
```

---

## Security Considerations

### 1. RLS Enforcement
- **Critical:** Privacy is enforced at database level, not UI level
- Frontend queries Supabase directly → RLS must be bulletproof
- Even if user modifies frontend code or uses browser console, they cannot access unauthorized events

### 2. Backend Authorization
- Poll-to-event: Validates leader status before creating event ✓
- Admin events: Validates admin JWT before creating event ✓
- No direct INSERT/DELETE from frontend (RLS blocks with `WITH CHECK (false)`)

### 3. Membership Validation
- RLS checks `memberships.status = 'approved'`
- Pending/kicked members cannot see circle events
- Consistent with other membership checks in system

---

## Testing Strategy

### Database Level
```sql
-- Test 1: Campus-wide events visible to all
SELECT * FROM campus_events WHERE community_id IS NULL;
-- Should return all campus events (RLS allows)

-- Test 2: Circle events filtered by membership
SELECT * FROM campus_events WHERE community_id IS NOT NULL;
-- Should only return events from circles user is approved member of

-- Test 3: Cannot see other circles' events
-- Login as user A (member of circle X)
SELECT * FROM campus_events WHERE community_id = '<circle_Y_id>';
-- Should return empty (RLS blocks)
```

### Backend Level
```javascript
// Test 1: Poll-to-event creates with community_id
// Create poll in circle X, close poll
// Verify: campus_events row has community_id = circle_X_id

// Test 2: Admin event creates with NULL community_id
// Create event via admin dashboard
// Verify: campus_events row has community_id = NULL
```

### Frontend Level
```javascript
// Test 1: Modal opens on clock click
// Test 2: Campus events shown in first section
// Test 3: Circle events shown in second section
// Test 4: Empty states display correctly
// Test 5: Event cards format dates/times correctly
// Test 6: Only upcoming events shown
```

---

## Performance Optimization

### Query Performance
- Index on `(community_id, start_date)` for fast filtering
- LIMIT 50 prevents large payloads
- Single query returns both campus and circle events

### UI Performance
- Modal lazy loads (only renders when open)
- Events cached in state (no re-fetch unless user refreshes)
- Smooth animations via CSS transitions

---

## Error Handling

### Backend Errors
```javascript
if (eventError) {
  console.error('Failed to create event:', eventError);
  // Event creation fails → poll still closes (graceful degradation)
  // User sees "Event could not be created" in response
}
```

### Frontend Errors
```javascript
if (error) {
  console.error('Failed to load events:', error);
  setEventsLoading(false);
  // Show error state in modal
  // User can close and retry
}
```

### Empty States
- No campus events → "No upcoming campus events"
- No circle events + has circles → "No upcoming events from your circles"
- No circle events + no circles → "Join circles to see their events"

---

## Documentation Updates

### 1. Poll-to-Event Design Doc
**File:** `.kiro/specs/poll-to-event-conversion/design.md`

**Changes:**
- FR4: Add "Set `community_id` to the poll's `community_id`"
- Backend implementation: Show `community_id` in INSERT statement
- Notification: Update link to open events modal (not just community page)
- Remove: Mentions of "leader-created events" (out of scope)

### 2. Database Schema Doc
**File:** `DATABASE_SCHEMA.md`

**Add to campus_events:**
```markdown
- community_id (uuid, nullable) - FK to communities.id
  - NULL: Campus-wide event (visible to all)
  - NOT NULL: Circle-specific event (visible to members only)
  - ON DELETE CASCADE (event deleted when circle deleted)
```

---

## Migration Rollback Plan

If migration causes issues:

```sql
-- Rollback: Remove community_id and restore old policies
ALTER TABLE campus_events DROP COLUMN community_id;
DROP INDEX idx_campus_events_community_date;

-- Restore permissive policies (temporary, for emergency only)
CREATE POLICY "Anyone can read events" ON campus_events 
FOR SELECT USING (true);
```

**Note:** This rollback breaks privacy for circle events. Only use if migration completely fails.

---

## Future Enhancements (Out of Scope for v1)

1. **Leader Manual Event Creation**
   - CRUD UI for circle leaders
   - Permissions check (rank_level > 0)
   - Event edit/delete from frontend

2. **Calendar Grid View**
   - Monthly/weekly calendar layout
   - Click dates to see events
   - Drag-and-drop (admin only)

3. **Event Details Page**
   - Dedicated route `/events/:id`
   - Full description, attachments, comments
   - Share link functionality

4. **RSVP/Attendance**
   - "Going" / "Maybe" / "Not Going"
   - Attendance tracking
   - Reminder notifications

5. **Event Notifications**
   - Notify members when new circle event created
   - Reminder 1 day before event
   - Customizable notification preferences

6. **Export to Calendar**
   - .ics file generation
   - Add to Google Calendar, Outlook, etc.
   - Sync with personal calendar apps

---

## Acceptance Checklist

- [ ] Migration creates `community_id` column with FK and index
- [ ] Migration drops old permissive RLS policies
- [ ] Migration creates new restrictive RLS policies
- [ ] Poll-to-event backend sets `community_id` correctly
- [ ] Admin event backend sets `community_id = NULL`
- [ ] Clock element in navigation is clickable
- [ ] Modal opens on clock click
- [ ] Modal displays campus-wide events (community_id IS NULL)
- [ ] Modal displays circle events (from user's approved memberships)
- [ ] Cannot see other circles' events (test in browser console)
- [ ] Only upcoming events shown (start_date >= today)
- [ ] Empty states are clear and helpful
- [ ] Modal is responsive (mobile + desktop)
- [ ] Modal closes on outside click or close button
- [ ] CSS styling matches existing UserPortal theme
- [ ] Documentation updated (Poll-to-Event + Database Schema)
