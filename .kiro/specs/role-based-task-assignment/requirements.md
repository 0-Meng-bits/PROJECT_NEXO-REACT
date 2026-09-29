# Requirements Document: Role-Based Task Assignment (Project Circles)

## Introduction
The Role-Based Task Assignment feature gives project communities a way to organize work by member role (Leader, Developer, Designer, Tester, Other), addressing the core coordination problem specific to project teams: knowing who owns what kind of work. This builds on the existing task_items table and TaskBoard UI, adding a role layer scoped per-membership so a user can hold different roles across different project circles.

## Glossary
- **Project_Role**: A label ('Leader', 'Developer', 'Designer', 'Tester', 'Other', or NULL) stored on a membership row, meaningful only for communities with category='project'
- **Community_Leader**: A user with rank_level >= 1 and status='approved' in a given community's memberships
- **Task_Assignee**: The user referenced by task_items.assigned_to
- **No Role**: The display state for a task assignee whose project_role is NULL

## Requirements

### Requirement 1: Project Role Assignment
**User Story:** As a community leader, I want to assign roles to members of my project circle, so that task ownership reflects each person's function on the team.

**Acceptance Criteria:**
- WHERE category='project', THE System SHALL allow a community leader to set a member's project_role
- THE System SHALL store project_role as a column on the memberships table, nullable, scoped to that membership row only
- THE System SHALL restrict project_role values to: 'Leader', 'Developer', 'Designer', 'Tester', 'Other'
- WHEN a member has no project_role set, THE System SHALL treat this as "No Role" rather than an error state
- WHERE community category is NOT 'project', THE System SHALL NOT display role-assignment UI

### Requirement 2: Role Assignment Authorization
**User Story:** As a system, I need to restrict who can change a member's role, so that only community leaders control team structure.

**Acceptance Criteria:**
- WHEN a user attempts to update a project_role, THE System SHALL verify the requesting user has rank_level >= 1 AND status='approved' in that same community
- THE System SHALL enforce this via a Row-Level Security policy that checks the caller's own membership row (via auth.uid()), not the target row being updated
- WHEN an unauthorized user attempts to change a role, THE System SHALL reject the operation

### Requirement 3: Task Assignment (Existing Behavior, Unchanged)
**User Story:** As a community leader, I want to assign tasks to specific members, so that responsibility for each task is clear.

**Acceptance Criteria:**
- THE System SHALL continue to use the existing task_items.assigned_to field for task assignment
- THE System SHALL restrict task assignment to community leaders, consistent with existing TaskBoard behavior (canManage)
- THE System SHALL NOT introduce a separate required_role field on tasks — a task's associated role is always derived from its assignee

### Requirement 4: Role Display on Tasks
**User Story:** As a project circle member, I want to see each task's assignee and their role, so that I understand who is responsible and in what capacity.

**Acceptance Criteria:**
- WHEN displaying a task with a non-null assigned_to, THE System SHALL show the assignee's project_role alongside their name
- THE System SHALL derive this by joining task_items → channels (for community_id) → memberships (matching both user_id = assigned_to AND community_id)
- WHEN the assignee's project_role is NULL, THE System SHALL display a "No Role" badge (gray, visually distinct from colored role badges)
- WHEN a task has no assignee, THE System SHALL NOT display a role badge

### Requirement 5: Filter Task Board by Role
**User Story:** As a project circle member, I want to filter the task board by role, so that I can quickly see what a given role owns.

**Acceptance Criteria:**
- THE System SHALL provide a filter control with options: All, Leader, Developer, Designer, Tester, Other, No Role
- WHEN a role filter is selected, THE System SHALL show only tasks whose assignee holds that project_role (or has no role, for the "No Role" filter)
- THE System SHALL apply the community-scoped JOIN (Requirement 4.2) when filtering, to avoid matching a user's role from a different project circle

### Requirement 6: Row-Level Security for Role Updates
**User Story:** As a system, I need database-level enforcement of role-assignment permissions, so that the rule cannot be bypassed from the browser console.

**Acceptance Criteria:**
- THE System SHALL create an UPDATE policy on memberships that restricts membership row updates to authorized community leaders, using a subquery against the caller's own membership row
- THE Policy SHALL check: caller's user_id = auth.uid(), caller's community_id matches the target row's community_id, caller's rank_level >= 1, and caller's status = 'approved'
- THE System SHALL apply this check in both USING and WITH CHECK clauses

### Future Enhancements (Deferred to v2)
- Custom/community-defined roles beyond the fixed five — deferred, fixed list is sufficient for v1
- Role-based notifications (e.g., notify all Designers when a Designer-relevant task is created) — deferred, no notification infrastructure change needed for v1
- Bulk role assignment (assign roles to multiple members at once) — deferred, one-at-a-time assignment is sufficient for v1 scale (small project teams)

---

**Important Context:**
- The existing TaskBoard component (capstone-react/src/components/TaskBoard.jsx) does NOT support assigning tasks during creation — assigned_to is left NULL and must be set via edit after creation
- The memberships table currently has: id, user_id, community_id, rank_level, status, created_at
- The task_items table has: id, channel_id, title, description, assigned_to, status, priority, due_date, created_by, created_at, updated_at, completed_at
- The channels table has: id, community_id, name, created_by, created_at
- Status values in memberships use: 'pending', 'approved', 'rejected' (NOT 'active')
