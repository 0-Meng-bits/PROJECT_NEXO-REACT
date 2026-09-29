# Design Document: Role-Based Task Assignment

## Overview

The Role-Based Task Assignment feature extends the existing task management system by introducing a role classification layer for project communities. This design adds a `project_role` column to the memberships table, allowing community leaders to label members by their function (Leader, Developer, Designer, Tester, Other) and enabling task filtering and visual organization by role.

### Key Design Decisions

**1. Role Storage on Memberships (Not Tasks)**
- Roles are membership-scoped attributes, not task attributes
- A user can have different roles in different project circles
- Tasks inherit role information through their assignee's membership

**2. Nullable Role Column**
- `project_role` defaults to NULL ("No Role" state)
- Not all project members need explicit roles
- NULL is a valid display state, not an error condition

**3. Database-Level Enforcement**
- RLS policies prevent unauthorized role changes
- Authorization checks use subqueries against the caller's own membership
- Follows existing project pattern: `auth.uid()` for caller identity

**4. UI Integration Points**
- Minimal TaskBoard modifications (no creation-time assignment)
- Role badges rendered alongside assignee names
- Filter control added above kanban columns

## Architecture

### System Components

```
┌─────────────────────────────────────────┐
│          UI Layer                       │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ TaskBoard    │  │ ManageGroup  │   │
│  │ + RoleFilter │  │ + RoleSelect │   │
│  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Supabase Client API               │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Database Layer                    │
│  ┌──────────────────────────────────┐  │
│  │ memberships + project_role       │  │
│  │ task_items (unchanged)           │  │
│  │ channels (unchanged)             │  │
│  │ RLS Policies (new UPDATE policy) │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Data Flow

**Role Assignment Flow:**
1. Leader opens ManageGroupModal (existing component in UserPortal.jsx)
2. New role dropdown renders for each member (project communities only)
3. Leader selects role from fixed list
4. UPDATE query hits memberships table
5. RLS policy verifies caller's rank_level >= 1 in same community
6. Role persisted to `memberships.project_role` column

**Task Display Flow:**
1. TaskBoard loads tasks via `task_items` query
2. For each task with `assigned_to`, query joins:
   - `task_items` → `channels` (to get `community_id`)
   - `channels` → `memberships` (matching `user_id` and `community_id`)
3. Extract `project_role` from matched membership
4. Render role badge with assignee name

**Filter Flow:**
1. User selects role filter (UI state)
2. Client filters loaded tasks where assignee's role matches selection
3. Re-render kanban columns with filtered subset

## Components and Interfaces

### Database Schema Changes

#### memberships Table Alteration

```sql
-- Add project_role column to memberships table
ALTER TABLE memberships 
ADD COLUMN project_role text 
CHECK (project_role IN ('Leader', 'Developer', 'Designer', 'Tester', 'Other'));

-- Column is nullable by default (NULL = "No Role")
-- No index needed: filtering happens client-side on already-loaded task data
```

**Rationale:**
- CHECK constraint enforces value domain at database level
- Nullable: not all members need roles, NULL is legitimate state
- No default value: explicit assignment only
- No migration needed for existing rows (NULL is valid)

### RLS Policies

#### Policy: Role Update Authorization

```sql
-- Policy: Only community leaders can update membership rows (including project_role)
-- Applied to memberships table UPDATE operations
CREATE POLICY "Community leaders can update member roles"
  ON memberships FOR UPDATE
  TO authenticated
  USING (
    -- Caller must be a leader in the same community
    EXISTS (
      SELECT 1 FROM memberships caller_membership
      WHERE caller_membership.user_id = auth.uid()
      AND caller_membership.community_id = memberships.community_id
      AND caller_membership.rank_level >= 1
      AND caller_membership.status = 'approved'
    )
  )
  WITH CHECK (
    -- Same check for post-update state
    EXISTS (
      SELECT 1 FROM memberships caller_membership
      WHERE caller_membership.user_id = auth.uid()
      AND caller_membership.community_id = memberships.community_id
      AND caller_membership.rank_level >= 1
      AND caller_membership.status = 'approved'
    )
  );
```

**Important Notes:**
- This policy applies to **all UPDATE operations** on memberships rows, not just project_role
- The policy checks the **caller's** membership (via `auth.uid()`), not the target row
- Both USING and WITH CHECK clauses ensure authorization before and after the update
- Status check uses 'approved' (not 'active') to match existing system conventions

### Frontend Components

#### 1. Role Assignment UI (ManageGroupModal Enhancement)

**Location:** `capstone-react/src/components/UserPortal.jsx` (existing ManageGroupModal)

**Changes:**
```jsx
// Inside ManageGroupModal, for each member row:
{community.category === 'project' && (
  <select
    value={member.project_role || ''}
    onChange={(e) => updateMemberRole(member.id, e.target.value)}
    disabled={!canManage}
  >
    <option value="">No Role</option>
    <option value="Leader">👑 Leader</option>
    <option value="Developer">💻 Developer</option>
    <option value="Designer">🎨 Designer</option>
    <option value="Tester">🧪 Tester</option>
    <option value="Other">📋 Other</option>
  </select>
)}
```

**Function:**
```javascript
const updateMemberRole = async (membershipId, newRole) => {
  const { error } = await supabase
    .from('memberships')
    .update({ project_role: newRole || null })
    .eq('id', membershipId);
  
  if (error) {
    toast.error('Failed to update role: ' + error.message);
  } else {
    toast.success('Role updated');
    refreshMemberList();
  }
};
```

#### 2. Role Display on Tasks (TaskCard Component)


**Location:** `capstone-react/src/components/TaskBoard.jsx` (TaskCard sub-component)

**Modified Query (loadTasks function):**

**Note on Query Pattern:** This uses an N+1 query pattern (one query per assigned task to fetch role). At the stated scale (small project teams, handful of tasks per board), this is acceptable and keeps the code simple. For larger scale, this would be optimized with a single IN query batching all assigned user IDs.
```javascript
const loadTasks = async () => {
  setLoading(true);
  
  // Get channel's community_id first
  const { data: channel } = await supabase
    .from('channels')
    .select('community_id')
    .eq('id', channelId)
    .single();
  
  if (!channel) return;
  
  // Load tasks with role information
  const { data, error } = await supabase
    .from('task_items')
    .select(`
      *,
      assigned_user:assigned_to(full_name, ctu_id),
      creator:created_by(full_name)
    `)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false });
  
  // Enrich with role data
  if (data) {
    for (const task of data) {
      if (task.assigned_to) {
        const { data: membership } = await supabase
          .from('memberships')
          .select('project_role')
          .eq('user_id', task.assigned_to)
          .eq('community_id', channel.community_id)
          .single();
        
        task.assignee_role = membership?.project_role || null;
      }
    }
  }
  
  if (!error) setTasks(data || []);
  setLoading(false);
};
```

**Role Badge Rendering:**
```jsx
// Inside TaskCard component, after "Creator" section:
{task.assigned_user && (
  <div style={{ fontSize: 10, marginBottom: 8 }}>
    <span style={{ color: 'var(--text-muted)' }}>Assigned: </span>
    <span style={{ color: 'var(--cyber-cyan)' }}>
      {task.assigned_user.full_name}
    </span>
    {task.assignee_role && (
      <span style={{
        marginLeft: 6,
        padding: '2px 6px',
        borderRadius: 10,
        fontSize: 9,
        background: getRoleColor(task.assignee_role) + '22',
        color: getRoleColor(task.assignee_role),
        border: `1px solid ${getRoleColor(task.assignee_role)}44`
      }}>
        {getRoleIcon(task.assignee_role)} {task.assignee_role}
      </span>
    )}
    {task.assigned_user && !task.assignee_role && (
      <span style={{
        marginLeft: 6,
        padding: '2px 6px',
        borderRadius: 10,
        fontSize: 9,
        background: 'rgba(148,163,184,0.1)',
        color: 'var(--text-muted)',
        border: '1px solid rgba(148,163,184,0.2)'
      }}>
        No Role
      </span>
    )}
  </div>
)}
```

**Helper Functions:**
```javascript
const getRoleColor = (role) => {
  const colors = {
    Leader: '#fbbf24',      // amber
    Developer: '#60a5fa',   // blue
    Designer: '#f472b6',    // pink
    Tester: '#34d399',      // emerald
    Other: '#a78bfa'        // purple
  };
  return colors[role] || 'var(--text-muted)';
};

const getRoleIcon = (role) => {
  const icons = {
    Leader: '👑',
    Developer: '💻',
    Designer: '🎨',
    Tester: '🧪',
    Other: '📋'
  };
  return icons[role] || '';
};
```

#### 3. Role Filter UI (TaskBoard Header)

**Location:** `capstone-react/src/components/TaskBoard.jsx` (Header section)

**State Management:**
```javascript
// Add to TaskBoard component state
const [roleFilter, setRoleFilter] = useState('All');
```

**Filter Control UI:**
```jsx
// Add between header and kanban board
<div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
    Filter by role:
  </span>
  {['All', 'Leader', 'Developer', 'Designer', 'Tester', 'Other', 'No Role'].map(role => (
    <button
      key={role}
      onClick={() => setRoleFilter(role)}
      style={{
        padding: '4px 12px',
        fontSize: 11,
        borderRadius: 12,
        border: roleFilter === role 
          ? `1px solid ${getRoleColor(role)}` 
          : '1px solid rgba(0,240,255,0.2)',
        background: roleFilter === role 
          ? getRoleColor(role) + '22' 
          : 'rgba(0,0,0,0.3)',
        color: roleFilter === role 
          ? getRoleColor(role) 
          : 'var(--text-muted)',
        cursor: 'pointer',
        fontWeight: roleFilter === role ? 700 : 400
      }}
    >
      {role !== 'All' && role !== 'No Role' && getRoleIcon(role)} {role}
    </button>
  ))}
</div>
```

**Filter Logic:**
```javascript
// Modify tasksByStatus to apply role filter
const getFilteredTasks = () => {
  if (roleFilter === 'All') return tasks;
  
  if (roleFilter === 'No Role') {
    return tasks.filter(t => t.assigned_to && !t.assignee_role);
  }
  
  return tasks.filter(t => t.assignee_role === roleFilter);
};

const tasksByStatus = {
  todo: getFilteredTasks().filter(t => t.status === 'todo'),
  in_progress: getFilteredTasks().filter(t => t.status === 'in_progress'),
  done: getFilteredTasks().filter(t => t.status === 'done')
};
```

## Implementation Sequence

### Phase 1: Database Setup (30 minutes)
1. Create migration file: `supabase/migrations/YYYYMMDD_add_project_role_to_memberships.sql`
2. Add ALTER TABLE statement for project_role column with CHECK constraint
3. Create RLS policy for role updates
4. Run migration in development
5. Verify column exists and policy is active

### Phase 2: Role Assignment UI (1 hour)
1. Modify ManageGroupModal in UserPortal.jsx
2. Add role dropdown (conditional on category='project')
3. Implement updateMemberRole function
4. Add role color/icon helper functions
5. Test role assignment (leader can set, member cannot)

### Phase 3: Role Display on Tasks (1 hour)
1. Modify loadTasks query in TaskBoard.jsx
2. Add role badge rendering to TaskCard
3. Handle "No Role" display state
4. Test role badges appear correctly

### Phase 4: Role Filter (45 minutes)
1. Add roleFilter state to TaskBoard
2. Add filter button row to TaskBoard header
3. Modify tasksByStatus to apply filter
4. Test filtering by each role including "No Role"

### Phase 5: Testing & Polish (45 minutes)
1. Test role assignment authorization (RLS enforcement)
2. Test multi-circle scenario (user has different roles in different projects)
3. Verify "No Role" handling throughout
4. Polish styling and transitions
5. Test mobile responsiveness

**Total Estimated Time:** 4 hours

## Edge Cases and Error Handling

### Edge Case 1: User in Multiple Project Circles
**Scenario:** User A is "Developer" in Project X and "Designer" in Project Y.

**Handling:**
- Role query joins on BOTH `user_id` AND `community_id`
- Tasks in Project X show "Developer" badge
- Tasks in Project Y show "Designer" badge
- No cross-contamination between circles

**Query Pattern:**
```sql
-- Correct: scoped to task's community
JOIN memberships m 
  ON m.user_id = task_items.assigned_to 
  AND m.community_id = channels.community_id

-- Wrong: would match any membership for the user
JOIN memberships m 
  ON m.user_id = task_items.assigned_to
```

### Edge Case 2: Unassigned Tasks
**Scenario:** Task has `assigned_to = NULL`.

**Handling:**
- No role badge displayed (task.assigned_user is null)
- Filter by role excludes unassigned tasks
- "All" filter includes unassigned tasks

### Edge Case 3: Role Deleted/Changed Mid-Session
**Scenario:** Leader changes member's role while another user views TaskBoard.

**Handling:**
- Real-time subscription on task_items already exists
- Add subscription to memberships table (optional enhancement)
- On UPDATE event, refresh task list to reflect new roles
- No UI state corruption (roles derived from DB, not cached)

### Edge Case 4: Non-Project Communities
**Scenario:** User opens TaskBoard in academic/social/hobby circle.

**Handling:**
- Role assignment UI does NOT render (conditional on category='project')
- No role badges displayed (project_role is NULL or ignored)
- Filter UI hidden or shows only "All" option

### Error Case 1: Unauthorized Role Update Attempt
**Scenario:** Non-leader tries to update project_role via browser console.

**Handling:**
- RLS policy rejects UPDATE operation
- Supabase returns permission error
- Frontend displays error toast: "You don't have permission to assign roles"

### Error Case 2: Invalid Role Value
**Scenario:** Malicious client attempts to set project_role = 'Admin' via API.

**Handling:**
- CHECK constraint rejects invalid value at database level
- Error returned before RLS policy even evaluates
- Frontend shows error: "Invalid role value"

### Error Case 3: Task Query Fails to JOIN Role
**Scenario:** Orphaned membership or race condition causes role JOIN to fail.

**Handling:**
- Task still displays without role badge
- assignee_role set to null (treated as "No Role")
- No UI crash or missing task cards

## Testing Strategy

### Unit Tests (Manual via Console)

**Test 1: Role Assignment**
```javascript
// As leader
const { data, error } = await supabase
  .from('memberships')
  .update({ project_role: 'Developer' })
  .eq('id', '<membership_id>');
// Expect: success

// As non-leader
// Expect: RLS error
```

**Test 2: Role Display**
```javascript
// Assign task to user with role "Designer"
// Load TaskBoard
// Verify: "🎨 Designer" badge appears on task card
```

**Test 3: Role Filter**
```javascript
// Click "Developer" filter
// Verify: only tasks assigned to Developers are visible
// Click "No Role" filter
// Verify: only tasks assigned to users without roles are visible
```

**Test 4: Multi-Circle Isolation**
```javascript
// User A is "Developer" in Circle 1, "Tester" in Circle 2
// Load TaskBoard for Circle 1
// Verify: tasks show "💻 Developer"
// Load TaskBoard for Circle 2
// Verify: tasks show "🧪 Tester"
```

### Integration Tests

**Test 5: Authorization Boundary**
1. Create project circle
2. Add two members: User A (leader), User B (member)
3. As User A, assign role "Developer" to User B → expect success
4. As User B, attempt to change own role to "Leader" → expect RLS denial
5. Verify User B's role remains "Developer"

**Test 6: Null Role Handling**
1. Assign task to user without project_role set
2. Verify "No Role" badge displays (gray)
3. Filter by "No Role" → verify task appears
4. Assign role to user → verify badge updates to colored role badge

## Open Questions / Future Considerations

**Q1: Should role assignment send notifications?**
- Current design: No notifications for role changes
- Rationale: Low-priority action, not time-sensitive
- Future: Could add "You were assigned the Developer role" notification

**Q2: Should leaders be able to assign tasks during creation?**
- Current design: No (consistent with existing TaskBoard)
- Add Task modal does NOT include assigned_to field
- Tasks must be assigned post-creation via edit action
- Future: Could add assignee dropdown to New Task modal

**Q3: Should "No Role" tasks be prominently flagged?**
- Current design: Gray badge, no special treatment
- Alternative: Orange warning badge for unroled assignments in project circles
- Decision: Keep neutral gray (roles are optional, not required)

**Q4: Should role changes require confirmation?**
- Current design: Immediate update on dropdown change
- Alternative: Modal confirmation "Change User X's role to Developer?"
- Decision: Immediate is fine (leaders are trusted, changes are reversible)

## Security Considerations

**1. RLS Policy Completeness**
- Policy covers UPDATE operations on memberships table
- Policy checks caller's membership, not target row
- Policy enforces rank_level AND status checks
- ✅ No way to bypass via client manipulation

**2. CHECK Constraint Enforcement**
- Database rejects invalid role values before application logic runs
- ✅ No SQL injection or invalid data possible

**3. Community Isolation**
- Role queries scoped to community_id via JOIN
- No cross-community role leakage
- ✅ User roles in Circle A never affect Circle B

**4. Frontend Authorization**
- UI hides role controls for non-leaders (category check + canManage)
- But does NOT rely on UI-only enforcement
- RLS provides true backend protection
- ✅ Defense in depth