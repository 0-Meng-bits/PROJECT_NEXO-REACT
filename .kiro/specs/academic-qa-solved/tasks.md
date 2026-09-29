# Implementation Tasks: Academic Q&A with Solved Marking

## Overview
Implementation checklist for the Academic Q&A feature. Tasks follow the implementation sequence in the design doc. Complete phases in order — database must be done before frontend.

**Total Estimated Time:** ~2.5 hours  
**Files to modify:** UserPortal.jsx (main), new migration SQL file

---

## Phase 1: Database Setup

### Task 1.1: Create Migration File
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create `supabase/migrations/YYYYMMDD_add_solution_comment_id.sql`
- [ ] Add ALTER TABLE statement
- [ ] Add RLS policy

**SQL:**
```sql
-- Add solution_comment_id to announcements
ALTER TABLE announcements
ADD COLUMN solution_comment_id uuid
REFERENCES post_comments(id) ON DELETE SET NULL;

-- RLS: Only OP or community creator can update solution_comment_id
CREATE POLICY "OP or creator can mark solution"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = announcements.community_id
      AND communities.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = announcements.community_id
      AND communities.creator_id = auth.uid()
    )
  );
```

**Acceptance Criteria:**
- Migration runs without errors
- `solution_comment_id` column exists on announcements
- RLS policy active in pg_policies

---

### Task 1.2: Run Migration and Verify
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify: `SELECT solution_comment_id FROM announcements LIMIT 1` returns without error
- [ ] Verify RLS policy visible in Supabase dashboard → Auth → Policies → announcements

**Acceptance Criteria:**
- Column queryable
- Existing rows have NULL (no data migration needed)
- Policy active

---

## Phase 2: POST_TYPE Config + Composer

### Task 2.1: Add Question to POST_TYPE Config
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Open `capstone-react/src/components/UserPortal.jsx`
- [ ] Find `const POST_TYPE = {` (line ~109)
- [ ] Add question entry after existing types

**Code:**
```javascript
question: { label: 'Question', color: '#22d3ee', icon: 'fa-solid fa-circle-question' },
```

**Acceptance Criteria:**
- POST_TYPE.question defined with color and icon
- No syntax errors

---

### Task 2.2: Add Question Option to Academic Circle Composer
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 2.1

**Subtasks:**
- [ ] Find the circle post type selector (line ~5175): the array `['announcement', 'event', 'shoutout', 'general', 'poll', ...(activeComm.category === 'hobby' ? ['showcase'] : [])]`
- [ ] Add question to the array conditionally for academic circles

**Code change:**
```javascript
// Before:
['announcement', 'event', 'shoutout', 'general', 'poll',
  ...(activeComm.category === 'hobby' ? ['showcase'] : [])
]

// After:
['announcement', 'event', 'shoutout', 'general', 'poll',
  ...(activeComm.category === 'hobby' ? ['showcase'] : []),
  ...(activeComm.category === 'academic' ? ['question'] : [])
]
```

**Acceptance Criteria:**
- "Question" option appears in post composer for academic circles only
- Does NOT appear in hobby/social/project circles
- Selecting it sets `post_type = 'question'`

---

## Phase 3: AnnouncementCard Changes

### Task 3.1: Add Question Detection State
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 2.1

**Subtasks:**
- [ ] Find `AnnouncementCard` component (line ~128)
- [ ] Find the `isShowcase` detection line
- [ ] Add question/solved detection below it

**Code:**
```javascript
// Detect question posts
const isQuestion = a.post_type === 'question';
const isSolved = isQuestion && !!a.solution_comment_id;
const [markingSolution, setMarkingSolution] = useState(false);

// Check if current user can mark solutions (OP or community creator)
const isAuthorizedSolver = isQuestion && (
  user?.id === a.author_id || 
  user?.id === a.communityCreatorId  // passed as prop (see Task 3.5)
);
```

**Acceptance Criteria:**
- `isQuestion` true for question posts only
- `isSolved` true when `solution_comment_id` is non-null
- `isAuthorizedSolver` correctly identifies OP and creator

---

### Task 3.2: Add Question Status Badge to Post Header
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 3.1

**Subtasks:**
- [ ] Find where the post type badge/label renders in `AnnouncementCard`
- [ ] Add solved/unanswered badge next to existing type label, conditional on `isQuestion`

**Code:**
```jsx
{isQuestion && (
  <span style={{
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 10,
    background: isSolved ? 'rgba(34,211,238,0.1)' : 'rgba(251,191,36,0.1)',
    color: isSolved ? '#22d3ee' : '#fbbf24',
    border: `1px solid ${isSolved ? 'rgba(34,211,238,0.3)' : 'rgba(251,191,36,0.3)'}`,
    fontWeight: 700,
    marginLeft: 8
  }}>
    {isSolved ? '✅ Solved' : '❓ Unanswered'}
  </span>
)}
```

**Acceptance Criteria:**
- Unsolved question shows amber "❓ Unanswered" badge
- Solved question shows cyan "✅ Solved" badge
- Non-question posts show no badge
- Badge updates when solution is marked/unmarked

---

### Task 3.3: Add timeSince Helper Function
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Add `timeSince` function near the top of UserPortal.jsx (before AnnouncementCard)

**Code:**
```javascript
const timeSince = (dateStr) => {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
};
```

**Acceptance Criteria:**
- Function returns human-readable relative time
- Handles minutes, hours, days, months correctly

---

### Task 3.4: Implement markSolution Function
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 1.2, Task 3.1

**Subtasks:**
- [ ] Add `markSolution` async function inside `AnnouncementCard`
- [ ] Validate comment belongs to this question before UPDATE
- [ ] Toggle: if already solution → NULL, otherwise → commentId
- [ ] Send notification on mark (not unmark, not self-mark)
- [ ] Call reload callback on success

**Code:**
```javascript
const markSolution = async (commentId) => {
  // Validate comment belongs to this question
  const targetComment = comments.find(c => c.id === commentId);
  if (!targetComment || targetComment.announcement_id !== a.id) {
    console.error('Comment does not belong to this question');
    return;
  }

  setMarkingSolution(true);
  
  const newValue = a.solution_comment_id === commentId ? null : commentId;
  
  const { error } = await supabase
    .from('announcements')
    .update({ solution_comment_id: newValue })
    .eq('id', a.id);
  
  if (error) {
    alert('Failed to update solution: ' + error.message);
  } else {
    // Notify comment author if marking (not unmarking) and not self
    if (newValue && targetComment.author_id !== user.id) {
      await supabase.from('notifications').insert([{
        user_id: targetComment.author_id,
        type: 'solution_marked',
        message: `Your answer was marked as the solution in "${a.title}"`,
        link_comm_id: a.community_id,
      }]);
    }
    onReload?.();
  }
  
  setMarkingSolution(false);
};
```

**Acceptance Criteria:**
- Marks/unmarks correctly (toggle behavior)
- Comment-belongs-to-question check prevents cross-post abuse
- Notification sent on mark, skipped on unmark and self-mark
- `onReload` called on success to refresh post data

---

### Task 3.5: Pass communityCreatorId Prop to AnnouncementCard
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 3.1

**Subtasks:**
- [ ] Find where `AnnouncementCard` is rendered in the circle announcements section
- [ ] Pass `communityCreatorId={activeComm?.creator_id}` as a prop
- [ ] Add `communityCreatorId` to `AnnouncementCard` prop destructuring
- [ ] Also pass `onReload` callback: `onReload={() => loadCircleAnnouncements(activeCommId)}`

**Code (in AnnouncementCard props):**
```jsx
<AnnouncementCard
  key={a.id}
  a={a}
  user={user}
  // ... existing props ...
  communityCreatorId={activeComm?.creator_id}
  onReload={() => loadCircleAnnouncements(activeCommId)}
/>
```

**Code (in AnnouncementCard destructuring):**
```javascript
function AnnouncementCard({ a, user, onPin, onDelete, onVote, onApply, onReport, avatarCache, communityCreatorId, onReload }) {
```

**Acceptance Criteria:**
- `communityCreatorId` accessible inside `AnnouncementCard`
- `onReload` prop triggers circle announcements refresh
- No prop-drilling errors

---

### Task 3.6: Add Solution Badge and Mark Button to Comments
**Status:** Not Started  
**Estimated Time:** 25 minutes  
**Dependencies:** Task 3.3, Task 3.4

**Subtasks:**
- [ ] Find comment rendering loop inside `AnnouncementCard`
- [ ] Add `isSolutionComment` check per comment
- [ ] Apply green border/background to solution comment
- [ ] Add "✅ Accepted Answer · solved X ago" badge at top of solution comment
- [ ] Add "Mark as Solution" / "Unmark Solution" button per comment (question posts + authorized solver only)

**Code:**
```jsx
{comments.map(c => {
  const isSolutionComment = c.id === a.solution_comment_id;
  return (
    <div
      key={c.id}
      style={{
        // ...existing styles...
        border: isSolutionComment
          ? '1px solid rgba(34,211,238,0.4)'
          : '1px solid rgba(255,255,255,0.05)',
        background: isSolutionComment
          ? 'rgba(34,211,238,0.04)'
          : 'transparent',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 8,
      }}
    >
      {/* Solution badge */}
      {isSolutionComment && (
        <div style={{ fontSize: 10, color: '#22d3ee', fontWeight: 700, marginBottom: 4 }}>
          ✅ Accepted Answer
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
            · solved {timeSince(c.created_at)}
          </span>
        </div>
      )}

      {/* ...existing comment content... */}

      {/* Mark/Unmark button */}
      {isQuestion && isAuthorizedSolver && (
        <button
          onClick={() => markSolution(c.id)}
          disabled={markingSolution}
          style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 8, marginTop: 4,
            border: isSolutionComment ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.1)',
            background: isSolutionComment ? 'rgba(34,211,238,0.1)' : 'transparent',
            color: isSolutionComment ? '#22d3ee' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {isSolutionComment ? '✅ Unmark Solution' : '○ Mark as Solution'}
        </button>
      )}
    </div>
  );
})}
```

**Acceptance Criteria:**
- Solution comment has green border and "✅ Accepted Answer · solved Xd ago" badge
- Mark button visible only to authorized solver on question posts
- Unmark button shown on already-marked solution
- Non-question posts show neither badge nor button

---

## Phase 4: Q&A Filter Bar

### Task 4.1: Add qaFilter State
**Status:** Not Started  
**Estimated Time:** 5 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Find the circle announcements state section in UserPortal.jsx
- [ ] Add: `const [qaFilter, setQaFilter] = useState('all');`
- [ ] Reset to 'all' when switching communities (add to community-change effect)

**Acceptance Criteria:**
- State initialized to 'all'
- Resets when user changes active community

---

### Task 4.2: Add Filter Bar UI
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 4.1

**Subtasks:**
- [ ] Find where circle announcements list renders
- [ ] Add filter bar above the list, conditional on `activeComm?.category === 'academic'`

**Code:**
```jsx
{activeComm?.category === 'academic' && (
  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
    {[
      { key: 'all', label: 'All Posts' },
      { key: 'questions', label: '❓ Questions' },
      { key: 'unanswered', label: '🔴 Unanswered' },
    ].map(f => (
      <button
        key={f.key}
        onClick={() => setQaFilter(f.key)}
        style={{
          padding: '4px 12px', fontSize: 11, borderRadius: 12,
          border: qaFilter === f.key ? '1px solid #22d3ee' : '1px solid rgba(0,240,255,0.2)',
          background: qaFilter === f.key ? 'rgba(34,211,238,0.1)' : 'rgba(0,0,0,0.3)',
          color: qaFilter === f.key ? '#22d3ee' : 'var(--text-muted)',
          cursor: 'pointer', fontWeight: qaFilter === f.key ? 700 : 400, transition: 'all 0.2s'
        }}
      >
        {f.label}
      </button>
    ))}
  </div>
)}
```

**Acceptance Criteria:**
- Filter bar only shows in academic circles
- All 3 options render
- Active filter highlighted in cyan

---

### Task 4.3: Wire Filter to Post List
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 4.2

**Subtasks:**
- [ ] Add `getFilteredCircleAnnouncements()` function
- [ ] Replace `circleAnnouncements.map(...)` with `getFilteredCircleAnnouncements().map(...)`

**Code:**
```javascript
const getFilteredCircleAnnouncements = () => {
  if (qaFilter === 'questions') {
    return circleAnnouncements.filter(a => a.post_type === 'question');
  }
  if (qaFilter === 'unanswered') {
    return circleAnnouncements.filter(a =>
      a.post_type === 'question' && !a.solution_comment_id
    );
  }
  return circleAnnouncements;
};
```

**Acceptance Criteria:**
- "All Posts" shows everything
- "Questions" shows only question posts
- "Unanswered" shows only unsolved questions
- Filter updates immediately on click

---

## Phase 5: Testing

### Task 5.1: Happy Path Test
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** All previous tasks

**Subtasks:**
- [ ] Join or create an academic circle
- [ ] Create a question post → verify "❓ Unanswered" badge
- [ ] Add a comment as another user
- [ ] As OP, mark comment as solution → verify "✅ Solved" badge + "✅ Accepted Answer" on comment
- [ ] Verify notification received by comment author
- [ ] Unmark → verify reverts to "❓ Unanswered"

**Acceptance Criteria:**
- Full mark/unmark cycle works
- Badges update correctly
- Notification delivered

---

### Task 5.2: Filter Test
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 5.1

**Subtasks:**
- [ ] Create one solved question, one unsolved question, one regular announcement
- [ ] "All Posts" → all three visible
- [ ] "Questions" → two questions visible, announcement hidden
- [ ] "Unanswered" → only unsolved question visible

**Acceptance Criteria:**
- All three filter states work correctly

---

### Task 5.3: Authorization Test
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 5.1

**Subtasks:**
- [ ] As a regular member (not OP, not creator), open question → verify no "Mark as Solution" button visible
- [ ] As OP, mark solution → success
- [ ] As community creator, mark/unmark → success
- [ ] Attempt via browser console as non-authorized user → expect RLS error

**Acceptance Criteria:**
- Mark button hidden for non-authorized users
- RLS rejects unauthorized UPDATE attempts
- Creator override works regardless of OP membership

---

### Task 5.4: Edge Case Test
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 5.1

**Subtasks:**
- [ ] Delete the solution comment → verify question reverts to "❓ Unanswered"
- [ ] Open a non-academic circle → verify no "Question" option in composer and no filter bar
- [ ] Create question post, mark own comment → verify no self-notification sent

**Acceptance Criteria:**
- ON DELETE SET NULL working
- Feature isolated to academic circles
- No self-notifications

---

## Summary

**Total Tasks:** 20 tasks across 5 phases  
**Total Estimated Time:** ~2.5 hours  

**Critical Path:**
1. Database (Phase 1) — must run before any frontend testing
2. POST_TYPE + Composer (Phase 2) — enables question creation
3. AnnouncementCard (Phase 3) — core mark/unmark logic
4. Filter bar (Phase 4) — unanswered discovery
5. Testing (Phase 5)

**Key Bug Guards (baked in from prior reviews):**
- `auth.uid()` in RLS, not client-supplied ID (closePoll lesson)
- Comment-belongs-to-question validation in `markSolution` (role JOIN lesson)
- `ON DELETE SET NULL` FK handles comment deletion (confirmed active)
- Creator override for OP-left-community scenario (stated explicitly in Req 2)
