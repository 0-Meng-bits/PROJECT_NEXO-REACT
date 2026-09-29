# Implementation Tasks: Role-Based Task Assignment

## Overview
Implementation checklist for the Role-Based Task Assignment feature for project circles. Tasks are organized by phase and should be completed in the order listed to maintain dependencies.

**Total Estimated Time:** 4 hours  
**Category:** Project Circle Feature  
**Dependencies:** Existing TaskBoard component, memberships table, task_items table

---

## Phase 1: Database Setup

### Task 1.1: Create Migration File
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create migration file: `supabase/migrations/YYYYMMDD_add_project_role_to_memberships.sql`
- [ ] Add header comment explaining purpose
- [ ] Verify migration naming convention matches existing files

**Acceptance Criteria:**
- File created in correct location
- Filename follows YYYYMMDD format
- No syntax errors

---

### Task 1.2: Add project_role Column to memberships
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Write ALTER TABLE statement for memberships
- [ ] Add project_role column (text, nullable)
- [ ] Add CHECK constraint: `project_role IN ('Leader', 'Developer', 'Designer', 'Tester', 'Other')`
- [ ] Verify NO default value (NULL is intentional)

**SQL:**
```sql
ALTER TABLE memberships 
ADD COLUMN project_role text 
CHECK (project_role IN ('Leader', 'Developer', 'Designer', 'Tester', 'Other'));
```

**Acceptance Criteria:**
- Column added to memberships table
- CHECK constraint enforces valid values
- Existing rows have NULL (no migration needed)
- Invalid values rejected at database level

---

### Task 1.3: Create RLS Policy for Role Updates
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 1.2

**Subtasks:**
- [ ] Write CREATE POLICY statement for memberships UPDATE
- [ ] Add USING clause with subquery checking caller's rank_level >= 1
- [ ] Add WITH CHECK clause (same logic as USING)
- [ ] Ensure status check uses 'approved' not 'active'
- [ ] Test policy blocks unauthorized updates

**SQL:**
```sql
CREATE POLICY "Community leaders can update member roles"
  ON memberships FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships caller_membership
      WHERE caller_membership.user_id = auth.uid()
      AND caller_membership.community_id = memberships.community_id
      AND caller_membership.rank_level >= 1
      AND caller_membership.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships caller_membership
      WHERE caller_membership.user_id = auth.uid()
      AND caller_membership.community_id = memberships.community_id
      AND caller_membership.rank_level >= 1
      AND caller_membership.status = 'approved'
    )
  );
```

**Acceptance Criteria:**
- Policy created successfully
- Leaders can update memberships in their community
- Non-leaders cannot update any memberships
- Cross-community updates blocked (community_id scoping works)

---

### Task 1.4: Run Migration and Verify
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 1.3

**Subtasks:**
- [ ] Run migration in local development environment
- [ ] Verify column exists: `SELECT project_role FROM memberships LIMIT 1`
- [ ] Verify CHECK constraint: Attempt `UPDATE memberships SET project_role = 'InvalidRole'` → expect error
- [ ] Verify RLS policy: Check pg_policies table
- [ ] Test unauthorized update attempt → expect permission error

**Acceptance Criteria:**
- Migration runs without errors
- Column queryable
- CHECK constraint working
- RLS policy active and enforcing

---

## Phase 2: Helper Functions and Constants

### Task 2.1: Add Role Configuration Constants
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Open `capstone-react/src/components/TaskBoard.jsx`
- [ ] Add ROLE_COLORS constant (Leader: amber, Developer: blue, Designer: pink, Tester: emerald, Other: purple)
- [ ] Add ROLE_ICONS constant (Leader: 👑, Developer: 💻, Designer: 🎨, Tester: 🧪, Other: 📋)
- [ ] Export or define at component level

**Code:**
```javascript
const ROLE_COLORS = {
  Leader: '#fbbf24',
  Developer: '#60a5fa',
  Designer: '#f472b6',
  Tester: '#34d399',
  Other: '#a78bfa'
};

const ROLE_ICONS = {
  Leader: '👑',
  Developer: '💻',
  Designer: '🎨',
  Tester: '🧪',
  Other: '📋'
};
```

**Acceptance Criteria:**
- Constants defined
- Colors are valid hex codes
- Icons render correctly in browser

---

### Task 2.2: Implement getRoleColor Helper
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** Task 2.1

**Subtasks:**
- [ ] Create `getRoleColor(role)` function in TaskBoard.jsx
- [ ] Return color from ROLE_COLORS or fallback to 'var(--text-muted)'
- [ ] Handle null/undefined role

**Code:**
```javascript
const getRoleColor = (role) => {
  return ROLE_COLORS[role] || 'var(--text-muted)';
};
```

**Acceptance Criteria:**
- Function returns correct color for valid roles
- Returns fallback for invalid/null roles
- No errors on undefined input

---

### Task 2.3: Implement getRoleIcon Helper
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** Task 2.1

**Subtasks:**
- [ ] Create `getRoleIcon(role)` function in TaskBoard.jsx
- [ ] Return icon from ROLE_ICONS or empty string
- [ ] Handle null/undefined role

**Code:**
```javascript
const getRoleIcon = (role) => {
  return ROLE_ICONS[role] || '';
};
```

**Acceptance Criteria:**
- Function returns correct icon for valid roles
- Returns empty string for invalid/null roles
- Emojis display correctly in UI

---

## Phase 3: Role Assignment UI

### Task 3.1: Locate ManageGroupModal Component
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Open `capstone-react/src/components/UserPortal.jsx`
- [ ] Find ManageGroupModal component definition
- [ ] Identify member list rendering section
- [ ] Note existing canManage check

**Acceptance Criteria:**
- ManageGroupModal located
- Member list rendering identified
- Understand existing permission checks

---

### Task 3.2: Add Role Dropdown to ManageGroupModal
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 3.1

**Subtasks:**
- [ ] Add conditional check: `{community.category === 'project' && ...}`
- [ ] Render role dropdown for each member
- [ ] Set dropdown value to `member.project_role || ''`
- [ ] Add onChange handler: `updateMemberRole(member.id, e.target.value)`
- [ ] Disable dropdown if !canManage
- [ ] Style dropdown to match existing UI

**Code:**
```jsx
{community.category === 'project' && (
  <div className="input-group">
    <label>ROLE</label>
    <select
      value={member.project_role || ''}
      onChange={(e) => updateMemberRole(member.id, e.target.value)}
      disabled={!canManage}
      style={{ /* match existing dropdown styles */ }}
    >
      <option value="">No Role</option>
      <option value="Leader">👑 Leader</option>
      <option value="Developer">💻 Developer</option>
      <option value="Designer">🎨 Designer</option>
      <option value="Tester">🧪 Tester</option>
      <option value="Other">📋 Other</option>
    </select>
  </div>
)}
```

**Acceptance Criteria:**
- Dropdown only renders in project communities
- All 5 roles + "No Role" option present
- Dropdown disabled for non-leaders
- Styling matches existing modal

---

### Task 3.3: Implement updateMemberRole Function
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 3.2

**Subtasks:**
- [ ] Create async function `updateMemberRole(membershipId, newRole)`
- [ ] Call supabase.from('memberships').update({ project_role: newRole || null })
- [ ] Handle error case: show toast.error with message
- [ ] Handle success: show toast.success and refresh member list
- [ ] Add loading state during update

**Code:**
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
    refreshMemberList(); // existing function
  }
};
```

**Acceptance Criteria:**
- Function updates database correctly
- Empty string converts to NULL
- Error toast shows on failure (e.g., RLS denial)
- Success toast shows on success
- Member list refreshes to show new role

---

### Task 3.4: Test Role Assignment
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 3.3

**Subtasks:**
- [ ] Create test project circle
- [ ] Add two members: User A (leader), User B (member)
- [ ] As User A, open ManageGroupModal
- [ ] Assign role "Developer" to User B → expect success
- [ ] As User B, attempt to change own role → expect no dropdown or error
- [ ] Verify User B's role persists in database

**Acceptance Criteria:**
- Leaders can assign roles
- Non-leaders cannot see/use role dropdown
- Roles persist across page refresh
- RLS policy enforcing correctly

---

## Phase 4: Role Display on Tasks

### Task 4.1: Modify loadTasks Query
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 1.4

**Subtasks:**
- [ ] Open `capstone-react/src/components/TaskBoard.jsx`
- [ ] Locate `loadTasks` function
- [ ] Get channel's community_id first
- [ ] For each task with assigned_to, query memberships for project_role
- [ ] Attach role to task object as `task.assignee_role`
- [ ] Handle case where membership not found (set role to null)

**Note:** This uses an N+1 query pattern (one membership query per assigned task). This is acceptable at small project team scale. For larger scale, would batch via single IN query.

**Code:**
```javascript
const loadTasks = async () => {
  setLoading(true);
  
  // Get channel's community_id
  const { data: channel } = await supabase
    .from('channels')
    .select('community_id')
    .eq('id', channelId)
    .single();
  
  if (!channel) {
    setLoading(false);
    return;
  }
  
  // Load tasks
  const { data, error } = await supabase
    .from('task_items')
    .select('*, assigned_user:assigned_to(full_name, ctu_id), creator:created_by(full_name)')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false});
  
  // Enrich with role data (scoped to community)
  if (data) {
    for (const task of data) {
      if (task.assigned_to) {
        const { data: membership } = await supabase
          .from('memberships')
          .select('project_role')
          .eq('user_id', task.assigned_to)
          .eq('community_id', channel.community_id)  // Critical: scopes to correct community
          .single();
        
        task.assignee_role = membership?.project_role || null;
      }
    }
  }
  
  if (!error) setTasks(data || []);
  setLoading(false);
};
```

**Acceptance Criteria:**
- Query correctly joins to get community_id
- Role data attached to each task
- Role query scoped to BOTH user_id AND community_id (prevents multi-circle bugs)
- NULL handled gracefully (unassigned or no role)
- No performance issues at stated scale

---

### Task 4.2: Add Role Badge to TaskCard
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 4.1, Task 2.2, Task 2.3

**Subtasks:**
- [ ] Locate TaskCard component in TaskBoard.jsx
- [ ] Find "Creator" section (currently displays task creator)
- [ ] Add "Assigned" section below creator
- [ ] Display assigned_user.full_name
- [ ] If assignee_role exists, render colored role badge
- [ ] If assigned but no role, render gray "No Role" badge
- [ ] Style badges with border, background, icon

**Code:**
```jsx
{/* After Creator section */}
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
        border: `1px solid ${getRoleColor(task.assignee_role)}44`,
        fontWeight: 600
      }}>
        {getRoleIcon(task.assignee_role)} {task.assignee_role}
      </span>
    )}
    {!task.assignee_role && (
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

**Acceptance Criteria:**
- Role badge displays for assigned tasks with roles
- "No Role" badge displays for assigned tasks without roles
- No badge for unassigned tasks
- Colors match ROLE_COLORS constant
- Icons render correctly

---

### Task 4.3: Test Role Display
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 4.2

**Subtasks:**
- [ ] Assign task to user with role "Designer"
- [ ] Open TaskBoard
- [ ] Verify: "🎨 Designer" badge appears in pink
- [ ] Assign task to user without role
- [ ] Verify: "No Role" badge appears in gray
- [ ] Leave task unassigned
- [ ] Verify: No role badge appears

**Acceptance Criteria:**
- All three states display correctly
- Colors and icons match design
- No console errors

---

## Phase 5: Role Filter UI

### Task 5.1: Add Role Filter State
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Add state to TaskBoard component: `const [roleFilter, setRoleFilter] = useState('All')`
- [ ] Verify state updates correctly

**Acceptance Criteria:**
- State initialized to 'All'
- setState function available

---

### Task 5.2: Render Filter Button Row
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 5.1, Task 2.2, Task 2.3

**Subtasks:**
- [ ] Add filter UI between header and kanban board
- [ ] Map over filter options: ['All', 'Leader', 'Developer', 'Designer', 'Tester', 'Other', 'No Role']
- [ ] Render button for each option
- [ ] Apply active styling when roleFilter matches option
- [ ] onClick: setRoleFilter(role)
- [ ] Style with role colors

**Code:**
```jsx
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
        fontWeight: roleFilter === role ? 700 : 400,
        transition: 'all 0.2s'
      }}
    >
      {role !== 'All' && role !== 'No Role' && getRoleIcon(role)} {role}
    </button>
  ))}
</div>
```

**Acceptance Criteria:**
- All 7 filter options render
- Active filter highlighted with role color
- Buttons wrap responsively
- Icons display for role options

---

### Task 5.3: Implement Filter Logic
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 5.2, Task 4.1

**Subtasks:**
- [ ] Create `getFilteredTasks()` function
- [ ] If roleFilter === 'All', return all tasks
- [ ] If roleFilter === 'No Role', return tasks where assigned_to exists but assignee_role is null
- [ ] Otherwise, return tasks where assignee_role === roleFilter
- [ ] Modify `tasksByStatus` to use getFilteredTasks() instead of tasks directly

**Code:**
```javascript
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

**Acceptance Criteria:**
- "All" shows all tasks
- Role filters show only tasks assigned to that role
- "No Role" shows only assigned tasks without roles
- Kanban columns update correctly when filter changes

---

### Task 5.4: Test Role Filter
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 5.3

**Subtasks:**
- [ ] Create project with multiple tasks assigned to different roles
- [ ] Click "Developer" filter → verify only Developer tasks show
- [ ] Click "No Role" filter → verify only unroled assigned tasks show
- [ ] Click "All" → verify all tasks return
- [ ] Test with empty states (no tasks match filter)

**Acceptance Criteria:**
- All filters work correctly
- Empty columns display "No tasks" message
- Filter state persists during session
- No performance issues

---

## Phase 6: Testing & Polish

### Task 6.1: Multi-Circle Role Isolation Test
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** All previous tasks

**Subtasks:**
- [ ] Create two project circles: Project A and Project B
- [ ] Add User X as member in both
- [ ] Assign User X role "Developer" in Project A
- [ ] Assign User X role "Designer" in Project B
- [ ] Create and assign task to User X in Project A → verify shows "💻 Developer"
- [ ] Create and assign task to User X in Project B → verify shows "🎨 Designer"
- [ ] Verify no cross-contamination

**Acceptance Criteria:**
- User can have different roles in different circles
- Task role badges correctly reflect circle-specific roles
- No bugs or incorrect role displays

---

### Task 6.2: Authorization Boundary Test
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 3.4

**Subtasks:**
- [ ] As non-leader, attempt to update project_role via browser console
- [ ] Verify RLS policy blocks the operation
- [ ] Verify error message returned
- [ ] As leader, update project_role → verify success

**Acceptance Criteria:**
- Non-leaders cannot bypass UI restrictions
- RLS policy enforces at database level
- Leaders can successfully update roles

---

### Task 6.3: UI Polish and Responsiveness
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** All UI tasks

**Subtasks:**
- [ ] Test on mobile viewport (320px width)
- [ ] Verify filter buttons wrap correctly
- [ ] Verify role badges readable on small screens
- [ ] Test role dropdown in ManageGroupModal on mobile
- [ ] Add hover effects to filter buttons
- [ ] Ensure smooth transitions

**Acceptance Criteria:**
- Feature works on mobile devices
- No layout breaks or overflow issues
- Hover effects smooth (0.2s transition)
- All text readable

---

### Task 6.4: Error Handling and Edge Cases
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** All previous tasks

**Subtasks:**
- [ ] Test unassigned task display (no role badge should appear)
- [ ] Test task assigned to deleted/orphaned user
- [ ] Test filtering with no matching tasks
- [ ] Test role update during active TaskBoard session (refresh behavior)
- [ ] Verify error toasts for all failure scenarios

**Acceptance Criteria:**
- All edge cases handled gracefully
- No crashes or missing tasks
- Error messages helpful and user-friendly

---

### Task 6.5: Documentation and Cleanup
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** All testing complete

**Subtasks:**
- [ ] Remove console.log statements from code
- [ ] Add JSDoc comments to helper functions
- [ ] Update project documentation (if applicable)
- [ ] Document known limitations in IMPLEMENTATION_STATUS.md

**Acceptance Criteria:**
- Code clean and production-ready
- No debug statements
- Functions documented

---

## Summary

**Total Tasks:** 24 tasks across 6 phases  
**Total Estimated Time:** ~4 hours  

**Critical Path:**
1. Database setup (Phase 1) - MUST be first
2. Helper functions (Phase 2) - needed for UI
3. Role assignment UI (Phase 3) - enables role setting
4. Role display (Phase 4) - shows roles on tasks
5. Role filter (Phase 5) - enables filtering
6. Testing (Phase 6) - validates everything works

**Risk Areas:**
- RLS policy correctness (test thoroughly in Task 6.2)
- Multi-circle role isolation (test in Task 6.1)
- Query performance with role JOIN (monitor in Task 4.1 - N+1 pattern acceptable at stated scale)
- Mobile responsiveness (test in Task 6.3)

**Dependencies:**
- Requires existing TaskBoard component
- Requires existing ManageGroupModal in UserPortal
- Requires memberships, task_items, channels tables
- Requires toast notification system
