# Design Document: Hobby Showcase Feature

## Overview

The Hobby Showcase feature extends the existing announcements/post system to support structured feedback through preset tags. This design leverages the existing post_type pattern and adds a new showcase_feedback table to track individual tag applications.

## Architecture Decisions

### Decision 1: Separate Feedback Table vs. Aggregate Columns
**Choice:** New `showcase_feedback` table with individual records per tag application  
**Rationale:** 
- Supports toggle behavior (users can remove their tags)
- Enables validation (prevents duplicate tags per user)
- Allows future attribution features without migration
- Standard relational design pattern

**Rejected Alternative:** Adding aggregate columns (effort_count, creative_count, etc.) to announcements table would require complex increment/decrement logic and lose per-user tracking.

### Decision 2: Fixed vs. Dynamic Tag Order
**Choice:** Fixed display order (Effort → Creative → Technique → Style → Impact)  
**Rationale:**
- Prevents "jumpy" UI when counts change
- Simpler implementation (no sorting logic)
- More predictable user experience
- Consistent across all showcase posts

### Decision 3: Client-Side vs. Server-Side Tag Aggregation
**Choice:** Client-side aggregation using Supabase real-time subscriptions  
**Rationale:**
- Leverages existing Supabase real-time infrastructure
- No new API endpoints needed
- Instant UI updates when tags change
- Reduces backend complexity

## Data Model

### New Table: showcase_feedback

```sql
CREATE TABLE showcase_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id, tag_type)
);

-- Index for fast tag count queries
CREATE INDEX idx_showcase_feedback_announcement ON showcase_feedback(announcement_id);

-- Index for checking if user already tagged
CREATE INDEX idx_showcase_feedback_user ON showcase_feedback(user_id, announcement_id);

-- RLS Policies
ALTER TABLE showcase_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can view feedback tags
CREATE POLICY "Anyone can view showcase feedback"
  ON showcase_feedback FOR SELECT
  USING (true);

-- Users can insert their own feedback tags
CREATE POLICY "Users can add their own feedback"
  ON showcase_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own feedback tags
CREATE POLICY "Users can remove their own feedback"
  ON showcase_feedback FOR DELETE
  USING (auth.uid() = user_id);
```

### Modified: POST_TYPE Config (Frontend)

```javascript
const POST_TYPE = {
  announcement: { label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
  event:        { label: 'Event',        color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
  shoutout:     { label: 'Shoutout',     color: 'var(--green)',        icon: 'fa-solid fa-star' },
  general:      { label: 'General',      color: 'var(--text-muted)',   icon: 'fa-solid fa-comment' },
  poll:         { label: 'Poll',         color: '#a855f7',             icon: 'fa-solid fa-chart-bar' },
  showcase:     { label: 'Showcase',     color: '#f59e0b',             icon: 'fa-solid fa-palette' },
};
```

### Feedback Tag Metadata

```javascript
const FEEDBACK_TAGS = [
  { id: 'effort',    label: 'Effort',    emoji: '👏', color: '#22c55e' },
  { id: 'creative',  label: 'Creative',  emoji: '💡', color: '#a855f7' },
  { id: 'technique', label: 'Technique', emoji: '🎯', color: '#3b82f6' },
  { id: 'style',     label: 'Style',     emoji: '🎨', color: '#ec4899' },
  { id: 'impact',    label: 'Impact',    emoji: '🔥', color: '#ef4444' },
];
```

## Component Architecture

### New Component: ShowcaseTagBar

**Purpose:** Display feedback tags with toggle buttons and aggregate counts

**Props:**
```typescript
interface ShowcaseTagBarProps {
  announcementId: string;
  authorId: string;
  communityId: string;
  currentUserId: string;
  currentUserName: string;
  isHobbyCommunity: boolean;
}
```

**Responsibilities:**
- Fetch and display tag counts from showcase_feedback table
- Subscribe to real-time tag updates
- Handle tag application/removal
- Prevent self-tagging
- Show user's applied tags with visual indicator

**State:**
```javascript
const [tagCounts, setTagCounts] = useState({
  effort: 0, creative: 0, technique: 0, style: 0, impact: 0
});
const [userTags, setUserTags] = useState(new Set()); // Tags applied by current user
const [loading, setLoading] = useState(false);
```

### Modified Component: AnnouncementCard

**Changes:**
1. Add showcase post type detection
2. Render visual frame for showcase posts
3. Include ShowcaseTagBar when post_type='showcase'
4. Add "Showcase" badge to header

### New Component: ShowcasePostCreator

**Purpose:** Modal/form for creating showcase posts with post type selector

**Props:**
```typescript
interface ShowcasePostCreatorProps {
  communityId: string;
  communityCategory: string;
  onClose: () => void;
}
```

**Features:**
- Show "Showcase" option only if category='hobby'
- Standard post creation fields (title, content)
- Sets post_type='showcase' when submitted

## User Flows

### Flow 1: Creating a Showcase Post

```
1. User clicks "New Post" in hobby community
2. System displays post creation modal
3. System shows post type selector with "Showcase" option (hobby only)
4. User selects "Showcase", enters title/content
5. User clicks "Create"
6. System inserts record into announcements with post_type='showcase'
7. System displays new showcase post with empty tag counts
```

**Validation:**
- Title required (min 3 characters)
- Content required (min 10 characters)
- Community category must be 'hobby'

### Flow 2: Applying a Feedback Tag

```
1. User views showcase post in hobby community
2. System displays tag buttons with current counts
3. User clicks "Technique" tag button
4. System validates:
   - User is not the post author ✓
   - Post type is 'showcase' ✓
   - User is approved member of community ✓
   - User hasn't already applied this tag ✓
5. System inserts record into showcase_feedback
6. System increments tag count in UI
7. System highlights button to show user's applied tag
8. System creates notification for post author
```

**Error Handling:**
- Self-tag attempt: Show toast "You cannot tag your own showcase"
- Not showcase post: Show toast "Invalid post type"
- Not a member: Show toast "Join this community to give feedback"
- Duplicate tag: Toggle to remove instead (no error)

### Flow 3: Removing a Feedback Tag

```
1. User views showcase post where they've applied tags
2. System highlights tags user has applied
3. User clicks highlighted tag button
4. System deletes record from showcase_feedback
5. System decrements tag count in UI
6. System removes highlight from button
```

### Flow 4: Viewing Tag Aggregates

```
1. Any user views showcase post
2. System queries:
   SELECT tag_type, COUNT(*) 
   FROM showcase_feedback 
   WHERE announcement_id = $1 
   GROUP BY tag_type
3. System displays counts in fixed order with format:
   "👏 12 Effort • 💡 8 Creative • 🎯 5 Technique • 🎨 3 Style • 🔥 2 Impact"
4. System subscribes to real-time updates
5. When tag is added/removed, counts update immediately
```

## Technical Specifications

### Query: Get Tag Counts for Post

```javascript
async function getTagCounts(announcementId) {
  const { data, error } = await supabase
    .from('showcase_feedback')
    .select('tag_type')
    .eq('announcement_id', announcementId);
  
  if (error) return null;
  
  // Aggregate counts
  const counts = { effort: 0, creative: 0, technique: 0, style: 0, impact: 0 };
  data.forEach(row => {
    counts[row.tag_type] = (counts[row.tag_type] || 0) + 1;
  });
  
  return counts;
}
```

### Query: Get User's Applied Tags

```javascript
async function getUserTags(announcementId, userId) {
  const { data, error } = await supabase
    .from('showcase_feedback')
    .select('tag_type')
    .eq('announcement_id', announcementId)
    .eq('user_id', userId);
  
  if (error) return new Set();
  
  return new Set(data.map(row => row.tag_type));
}
```

### Mutation: Apply Tag

```javascript
async function applyTag(announcementId, userId, userName, tagType, authorId, communityId) {
  // Validation 1: Check self-tagging
  if (userId === authorId) {
    throw new Error('You cannot tag your own showcase');
  }
  
  // Validation 2: Verify post is showcase type
  const { data: post, error: postError } = await supabase
    .from('announcements')
    .select('post_type')
    .eq('id', announcementId)
    .single();
  
  if (postError || !post) {
    throw new Error('Post not found');
  }
  
  if (post.post_type !== 'showcase') {
    throw new Error('Can only tag showcase posts');
  }
  
  // Validation 3: Verify user is member of community
  const { data: membership, error: memberError } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .eq('status', 'approved')
    .single();
  
  if (memberError || !membership) {
    throw new Error('You must be a member of this community to give feedback');
  }
  
  // Insert (unique constraint handles duplicates)
  const { error } = await supabase
    .from('showcase_feedback')
    .insert({
      announcement_id: announcementId,
      user_id: userId,
      tag_type: tagType
    });
  
  if (error) throw error;
  
  // Create notification
  await supabase
    .from('notifications')
    .insert({
      user_id: authorId,
      type: 'showcase_feedback',
      message: `${userName} gave your showcase a ${tagType} tag`,
      link_comm_id: communityId
    });
}
```

### Mutation: Remove Tag

```javascript
async function removeTag(announcementId, userId, tagType) {
  const { error } = await supabase
    .from('showcase_feedback')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('user_id', userId)
    .eq('tag_type', tagType);
  
  if (error) throw error;
}
```

### Real-Time Subscription

```javascript
useEffect(() => {
  const subscription = supabase
    .channel(`showcase:${announcementId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'showcase_feedback',
        filter: `announcement_id=eq.${announcementId}`
      },
      () => {
        // Refresh tag counts
        refreshTagCounts();
      }
    )
    .subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}, [announcementId]);
```

## UI/UX Specifications

### Showcase Post Visual Frame

```css
.announcement-card.showcase {
  border: 2px solid #f59e0b;
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.05),
    rgba(245, 158, 11, 0.02)
  );
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
}

.showcase-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid #f59e0b;
  color: #f59e0b;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}
```

### Tag Button States

```css
.tag-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.tag-button:hover {
  border-color: var(--tag-color);
  background: rgba(var(--tag-color-rgb), 0.1);
}

.tag-button.applied {
  border-color: var(--tag-color);
  background: rgba(var(--tag-color-rgb), 0.2);
  box-shadow: 0 0 10px rgba(var(--tag-color-rgb), 0.3);
}

.tag-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Tag Display Format

```
👏 12 Effort  •  💡 8 Creative  •  🎯 5 Technique  •  🎨 3 Style  •  🔥 2 Impact
```

**Layout:**
- Horizontal flex layout
- Separators (•) between tags
- Emoji + count + label
- Each tag uses its designated color
- Responsive: wrap on mobile

## Security Considerations

### RLS Policies
- Anyone can view feedback tags (public data)
- Users can only insert their own tags (RLS enforces user_id match)
- Users can only delete their own tags
- No server-side admin override needed (community creators can't manipulate tags)

**Note:** RLS policies enforce user identity only. Additional validation (self-tagging prevention, community membership, post type verification) is enforced at the application layer in the `applyTag` function. Database-level enforcement via RLS subqueries or triggers is deferred to v2 as a scope decision.

### Validation Layers

**Database Level:**
- UNIQUE constraint prevents duplicate tags
- CHECK constraint enforces valid tag types
- Foreign keys ensure referential integrity
- RLS ensures users can only insert/delete their own tags

**Application Level (enforced in applyTag function):**
- Check user is not post author (self-tagging prevention)
- Check user is community member (query memberships table, status='approved')
- Check post type is 'showcase' (query announcements table)
- Check community category is 'hobby' (enforced at UI layer during post creation)

**Security Note:** Application-layer validation is sufficient for v1 given the trusted user base (verified CTU students/faculty). For production scale, consider moving validation into database-layer triggers or enhanced RLS policies to prevent API bypass.

## Performance Considerations

### Indexing Strategy
- Index on announcement_id for fast tag count queries
- Index on (user_id, announcement_id) for checking user's applied tags
- Composite unique index handles duplicate prevention

### Query Optimization
- Tag counts aggregated client-side from individual records
- Real-time subscriptions scoped per announcement (not global)
- Lazy load showcase posts (don't query tags until post visible)

### Scalability
- Each showcase post has max 5 tag types
- Unique constraint limits records to (users × 5) per post
- Typical hobby community: 50-100 members = 500 max records per post
- Well within Supabase performance limits

## Testing Strategy

### Unit Tests
- Tag application logic (apply/remove/toggle)
- Tag count aggregation
- Validation rules (self-tagging, duplicates)

### Integration Tests
- Create showcase post → Apply tags → Verify counts
- Toggle tag → Verify removal
- Real-time updates across clients

### Manual Testing Scenarios
1. Create showcase in hobby community (should work)
2. Try to create showcase in academic community (should fail)
3. Apply all 5 tags to a showcase
4. Try to tag own showcase (should show error)
5. Try to apply same tag twice (should toggle off)
6. Verify real-time updates with multiple users
7. Test notification delivery to post author

## Migration Plan

### Step 1: Database Migration
```sql
-- Run: supabase/migrations/YYYYMMDD_add_showcase_feedback.sql
-- Creates showcase_feedback table with indexes and RLS policies
```

### Step 2: Frontend Updates
1. Add 'showcase' to POST_TYPE config
2. Create ShowcaseTagBar component
3. Modify AnnouncementCard to detect and render showcase posts
4. Add showcase option to post creation form (hobby only)

### Step 3: Testing & Deployment
1. Test in staging environment
2. Verify RLS policies work correctly
3. Test real-time subscriptions
4. Deploy migration
5. Deploy frontend changes

### Rollback Plan
- Drop showcase_feedback table
- Revert frontend changes
- Existing showcase posts render as 'general' type (graceful degradation)

## Future Enhancements (Out of Scope for v1)

### Attribution View
- Show which users applied each tag type
- Creator-only visibility
- Requires additional UI component

### Notification Batching
- Aggregate multiple tag applications within 5-minute window
- Requires background job or queue system
- Prevents notification spam

### Showcase Analytics
- Profile page showing creator's showcase posts by engagement
- Sort by total tag counts
- Filter by tag type
- Requires new page/route

### Trust Point Integration
- Trust-point gating for feedback tag application (e.g., require Low Trust or above)
- Deferred as low priority given natural rate-limiting via unique constraint (one tag per user per type)
- Better target would be showcase post creation (similar to existing "restricted can't create circles" tier) if any trust integration is added
- Current v1 treats feedback tags as low-risk action (closer to "like" than "post")
