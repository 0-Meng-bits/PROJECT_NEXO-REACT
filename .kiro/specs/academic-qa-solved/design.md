# Design Document: Academic Q&A with Solved Marking

## Overview

This feature adds a `post_type='question'` variant to academic communities, with a `solution_comment_id` FK on announcements that points to the accepted answer. It builds entirely on the existing `AnnouncementCard` component, `post_comments` table, and `POST_TYPE` config — minimal new infrastructure, maximum reuse of established patterns.

## Key Design Decisions

**1. solution_comment_id on announcements, not a separate table**
- Single nullable FK column — NULL = unsolved, non-null = solved
- No separate `is_solved` boolean needed
- `ON DELETE SET NULL` handles comment deletion automatically

**2. Authorization via auth.uid() subquery, not client ID**
- RLS checks `auth.uid() = announcements.author_id` OR `auth.uid() = communities.creator_id`
- No closerId param passed from client — same fix as closePoll bug
- Creator override applies regardless of OP membership status

**3. Comment scoping validation in frontend**
- Before calling UPDATE, verify `comment.announcement_id === question.id`
- Prevents marking a comment from a different post as solution
- Mirrors the role JOIN community_id scoping fix

**4. Filter is client-side on loaded posts**
- Same pattern as role filter in TaskBoard
- No extra DB query — filter on already-loaded `circleAnnouncements` state

## Architecture

```
┌─────────────────────────────────────────────┐
│            UI Layer                         │
│  AnnouncementCard                           │
│  + isQuestion detection                     │
│  + solution badge on comments               │
│  + "Mark as Solution" / "Unmark" buttons    │
│  + Q&A filter bar (All / Questions /        │
│    Unanswered)                              │
│                                             │
│  Post Composer                              │
│  + "Question" type in academic circles      │
└─────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│         Supabase Client                     │
└─────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│         Database Layer                      │
│  announcements + solution_comment_id        │
│  post_comments (unchanged)                  │
│  RLS UPDATE policy on announcements         │
└─────────────────────────────────────────────┘
```

## Database Schema Changes

### announcements table (ALTER)

```sql
ALTER TABLE announcements
ADD COLUMN solution_comment_id uuid
REFERENCES post_comments(id) ON DELETE SET NULL;
```

### RLS Policy: Solution Marking Authorization

```sql
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

**Notes:**
- Checks `auth.uid()` server-side — no client-supplied user ID
- Creator override applies unconditionally (covers OP-left-community case)
- Applies to all UPDATE operations on announcements, not just solution_comment_id

## Components and Interfaces

### 1. POST_TYPE Config Update

**Location:** `capstone-react/src/components/UserPortal.jsx` (top of file, POST_TYPE constant)

```javascript
const POST_TYPE = {
  // ... existing types ...
  question: { label: 'Question', color: '#22d3ee', icon: 'fa-solid fa-circle-question' },
};
```

### 2. Post Composer — Question Type Option

**Location:** Circle post composer in UserPortal.jsx

```jsx
// Existing line (around line 5175):
{['announcement', 'event', 'shoutout', 'general', 'poll', 
  ...(activeComm.category === 'hobby' ? ['showcase'] : []),
  ...(activeComm.category === 'academic' ? ['question'] : [])   // ADD THIS
].map(t => { ... })}
```

### 3. AnnouncementCard — Question Detection + Solution State

**Location:** `AnnouncementCard` component (line ~128)

**New state to add:**
```javascript
const isQuestion = a.post_type === 'question';
const isSolved = isQuestion && !!a.solution_comment_id;

// State for marking (only loaded when comments are open)
const [markingSolution, setMarkingSolution] = useState(false);

// Check if current user is authorized to mark solutions
const isAuthorizedSolver = user?.id === a.author_id || user?.id === communityCreatorId;
```

**Note:** `communityCreatorId` needs to be passed as a prop to `AnnouncementCard` from the circle announcements section where `activeComm.creator_id` is available.

### 4. AnnouncementCard — loadAnnouncements Query Update

The `loadCircleAnnouncements` query needs to include `solution_comment_id`:

```javascript
const { data } = await supabase
  .from('announcements')
  .select('*, solution_comment_id')   // already selects * so this is automatic
  .eq('community_id', commId)
  .order('pinned', { ascending: false })
  .order('created_at', { ascending: false });
```

Since the query uses `select('*')`, the new column will be included automatically once the migration runs. No query change needed.

### 5. markSolution Function

**Location:** Inside `AnnouncementCard` component

```javascript
const markSolution = async (commentId) => {
  // Frontend validation: ensure comment belongs to this question
  const targetComment = comments.find(c => c.id === commentId);
  if (!targetComment || targetComment.announcement_id !== a.id) {
    console.error('Comment does not belong to this question');
    return;
  }

  setMarkingSolution(true);
  
  // Toggle: if already solution, unmark; otherwise mark
  const newValue = a.solution_comment_id === commentId ? null : commentId;
  
  const { error } = await supabase
    .from('announcements')
    .update({ solution_comment_id: newValue })
    .eq('id', a.id);
  
  if (error) {
    alert('Failed to update solution: ' + error.message);
  } else {
    // Send notification if marking (not unmarking) and not self-marking
    if (newValue && targetComment.author_id !== user.id) {
      await supabase.from('notifications').insert([{
        user_id: targetComment.author_id,
        type: 'solution_marked',
        message: `Your answer was marked as the solution in "${a.title}"`,
        link_comm_id: a.community_id,
      }]);
    }
    // Reload to reflect updated solution_comment_id
    onReload?.();
  }
  
  setMarkingSolution(false);
};
```

### 6. Comment Rendering — Solution Badge + Mark Button

**Location:** Inside `AnnouncementCard`, comment rendering section

```jsx
{comments.map(c => {
  const isSolutionComment = c.id === a.solution_comment_id;
  
  return (
    <div
      key={c.id}
      style={{
        // existing comment styles...
        border: isSolutionComment 
          ? '1px solid rgba(34,211,238,0.5)' 
          : '1px solid rgba(255,255,255,0.05)',
        background: isSolutionComment 
          ? 'rgba(34,211,238,0.05)' 
          : 'transparent',
      }}
    >
      {/* Solution badge */}
      {isSolutionComment && (
        <div style={{ 
          fontSize: 10, color: '#22d3ee', fontWeight: 700,
          marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4
        }}>
          ✅ Accepted Answer
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
            · solved {timeSince(c.created_at)}
          </span>
        </div>
      )}

      {/* existing comment content */}
      
      {/* Mark/Unmark button — only for authorized solvers on question posts */}
      {isQuestion && isAuthorizedSolver && (
        <button
          onClick={() => markSolution(c.id)}
          disabled={markingSolution}
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 8,
            border: isSolutionComment 
              ? '1px solid rgba(34,211,238,0.4)' 
              : '1px solid rgba(255,255,255,0.1)',
            background: isSolutionComment 
              ? 'rgba(34,211,238,0.1)' 
              : 'transparent',
            color: isSolutionComment ? '#22d3ee' : 'var(--text-muted)',
            cursor: 'pointer',
            marginTop: 4
          }}
        >
          {isSolutionComment ? '✅ Unmark Solution' : '○ Mark as Solution'}
        </button>
      )}
    </div>
  );
})}
```

### 7. Question Post Visual Distinction

**Location:** `AnnouncementCard` header area

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

### 8. Q&A Filter Bar

**Location:** Circle announcements section in UserPortal.jsx, above the post list

**State:**
```javascript
const [qaFilter, setQaFilter] = useState('all'); // 'all' | 'questions' | 'unanswered'
```

**Filter logic:**
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

**UI (only shown in academic circles):**
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
          padding: '4px 12px',
          fontSize: 11,
          borderRadius: 12,
          border: qaFilter === f.key 
            ? '1px solid #22d3ee' 
            : '1px solid rgba(0,240,255,0.2)',
          background: qaFilter === f.key ? 'rgba(34,211,238,0.1)' : 'rgba(0,0,0,0.3)',
          color: qaFilter === f.key ? '#22d3ee' : 'var(--text-muted)',
          cursor: 'pointer',
          fontWeight: qaFilter === f.key ? 700 : 400,
          transition: 'all 0.2s'
        }}
      >
        {f.label}
      </button>
    ))}
  </div>
)}
```

## Helper Function

```javascript
// Add near top of file or inside AnnouncementCard
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

## Implementation Sequence

### Phase 1: Database (15 min)
1. Create migration file with ALTER TABLE and RLS policy
2. Run in Supabase SQL Editor
3. Verify column exists

### Phase 2: POST_TYPE + Composer (20 min)
1. Add `question` to POST_TYPE config
2. Add `question` option to academic circle composer

### Phase 3: AnnouncementCard Changes (1 hour)
1. Add `isQuestion`, `isSolved`, `isAuthorizedSolver` detection
2. Add question badge (Solved/Unanswered) to post header
3. Add `markSolution` function
4. Add solution badge + mark/unmark button to comment rendering
5. Pass `communityCreatorId` prop where AnnouncementCard is rendered

### Phase 4: Q&A Filter (30 min)
1. Add `qaFilter` state to circle view
2. Add filter bar (academic circles only)
3. Wire `getFilteredCircleAnnouncements()` to post list rendering

### Phase 5: Testing (30 min)
1. Create question post, verify badge shows "Unanswered"
2. Add comments, mark solution — verify ✅ badge, notification sent
3. Unmark — verify reverts to "Unanswered"
4. Test unauthorized user cannot see mark button
5. Test Unanswered filter

**Total: ~2.5 hours**

## Edge Cases

| Scenario | Handling |
|---|---|
| OP leaves community | Creator can still mark/unmark — covered by RLS creator override |
| Solution comment deleted | `ON DELETE SET NULL` reverts to unsolved automatically |
| Non-academic circle | Question option hidden in composer, no filter bar shown |
| Self-mark notification | Skipped: `if (newValue && targetComment.author_id !== user.id)` |
| Comment from wrong post | Frontend validates `comment.announcement_id === a.id` before UPDATE |
| Unauthorized mark attempt | RLS rejects UPDATE, error shown to user |
