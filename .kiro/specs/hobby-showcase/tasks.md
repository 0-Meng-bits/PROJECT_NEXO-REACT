# Implementation Tasks: Hobby Showcase Feature

## Overview
Implementation checklist for the Hobby Showcase feature. Tasks are organized by component/layer and should be completed in the order listed to maintain dependencies.

---

## Phase 1: Database Setup

### Task 1.1: Create showcase_feedback Migration
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create migration file: `supabase/migrations/YYYYMMDD_add_showcase_feedback.sql`
- [ ] Add CREATE TABLE statement for showcase_feedback with all fields (id, announcement_id, user_id, tag_type, created_at)
- [ ] Add CHECK constraint for tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')
- [ ] Add UNIQUE constraint on (announcement_id, user_id, tag_type)
- [ ] Add foreign key constraints (announcement_id → announcements, user_id → profiles)
- [ ] Create index: `idx_showcase_feedback_announcement` on announcement_id
- [ ] Create index: `idx_showcase_feedback_user` on (user_id, announcement_id)

**Acceptance Criteria:**
- Migration file runs without errors
- Table created with correct schema
- Constraints and indexes in place

---

### Task 1.2: Add RLS Policies for showcase_feedback
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 1.1

**Subtasks:**
- [ ] Enable RLS on showcase_feedback table
- [ ] Create SELECT policy: "Anyone can view showcase feedback" (USING true)
- [ ] Create INSERT policy: "Users can add their own feedback" (WITH CHECK auth.uid() = user_id)
- [ ] Create DELETE policy: "Users can remove their own feedback" (USING auth.uid() = user_id)
- [ ] Test policies with different user contexts

**Acceptance Criteria:**
- All users can view feedback tags
- Users can only insert their own tags
- Users can only delete their own tags
- Admin cannot override via RLS (intentional design)

---

### Task 1.3: Run Migration and Verify
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 1.1, Task 1.2

**Subtasks:**
- [ ] Run migration in local development environment
- [ ] Verify table exists: `SELECT * FROM showcase_feedback LIMIT 1`
- [ ] Verify indexes: Check pg_indexes for showcase_feedback
- [ ] Verify RLS policies: Check pg_policies for showcase_feedback
- [ ] Test unique constraint by attempting duplicate insert
- [ ] Test CHECK constraint by attempting invalid tag_type

**Acceptance Criteria:**
- Table exists and is queryable
- Indexes present
- RLS policies active
- Constraints working as expected

---

## Phase 2: Frontend Constants & Configuration

### Task 2.1: Add showcase to POST_TYPE Config
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Open `capstone-react/src/components/UserPortal.jsx`
- [ ] Locate POST_TYPE constant definition
- [ ] Add showcase entry: `showcase: { label: 'Showcase', color: '#f59e0b', icon: 'fa-solid fa-palette' }`
- [ ] Verify icon class exists in Font Awesome

**Acceptance Criteria:**
- showcase post type defined
- Color and icon specified
- No syntax errors

---

### Task 2.2: Create FEEDBACK_TAGS Constant
**Status:** Not Started  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Subtasks:**
- [ ] Create new constant in UserPortal.jsx or separate config file
- [ ] Define array with 5 tag objects: effort, creative, technique, style, impact
- [ ] Each object has: id, label, emoji, color
- [ ] Use colors: effort=#22c55e, creative=#a855f7, technique=#3b82f6, style=#ec4899, impact=#ef4444

**Acceptance Criteria:**
- FEEDBACK_TAGS constant exported/accessible
- All 5 tags defined with correct properties
- Emojis render correctly: 👏💡🎯🎨🔥

---

## Phase 3: Utility Functions

### Task 3.1: Implement getTagCounts Function
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 1.3

**Subtasks:**
- [ ] Create utility function `getTagCounts(announcementId)`
- [ ] Query showcase_feedback table filtered by announcement_id
- [ ] Aggregate counts client-side into object: `{ effort: 0, creative: 0, technique: 0, style: 0, impact: 0 }`
- [ ] Handle error cases (return null or default counts)
- [ ] Add JSDoc comment with parameters and return type

**Acceptance Criteria:**
- Function returns correct counts for given announcement
- Returns zero counts for announcement with no tags
- Handles errors gracefully

---

### Task 3.2: Implement getUserTags Function
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 1.3

**Subtasks:**
- [ ] Create utility function `getUserTags(announcementId, userId)`
- [ ] Query showcase_feedback filtered by announcement_id AND user_id
- [ ] Return Set of tag_type values
- [ ] Handle error cases (return empty Set)

**Acceptance Criteria:**
- Function returns Set of user's applied tags
- Returns empty Set if user has no tags
- Handles errors gracefully

---

### Task 3.3: Implement applyTag Function
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 1.3

**Subtasks:**
- [ ] Create async function `applyTag(announcementId, userId, userName, tagType, authorId, communityId)`
- [ ] Validation 1: Check if userId === authorId, throw error "You cannot tag your own showcase"
- [ ] Validation 2: Query announcements table, verify post_type='showcase'
- [ ] Validation 3: Query memberships table, verify user is approved member
- [ ] Insert record into showcase_feedback
- [ ] Create notification for post author
- [ ] Handle duplicate tag error gracefully (unique constraint violation)

**Acceptance Criteria:**
- All validation checks working
- Self-tagging prevented
- Non-members blocked
- Non-showcase posts blocked
- Notification created on successful tag application
- Duplicate tags handled without crashing

---

### Task 3.4: Implement removeTag Function
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 1.3

**Subtasks:**
- [ ] Create async function `removeTag(announcementId, userId, tagType)`
- [ ] Delete record from showcase_feedback matching all three fields
- [ ] Handle error cases (record not found, etc.)
- [ ] No notification on tag removal (per requirements)

**Acceptance Criteria:**
- Function successfully removes tag
- Returns without error if tag doesn't exist
- No notification created

---

## Phase 4: ShowcaseTagBar Component

### Task 4.1: Create ShowcaseTagBar Component File
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 2.2

**Subtasks:**
- [ ] Create file: `capstone-react/src/components/ShowcaseTagBar.jsx`
- [ ] Import React, useState, useEffect, useCallback
- [ ] Import supabase from '../lib/supabase'
- [ ] Import FEEDBACK_TAGS constant
- [ ] Define component with props: announcementId, authorId, communityId, currentUserId, currentUserName
- [ ] Add basic component structure and export

**Acceptance Criteria:**
- File created
- Component renders without errors
- Props defined correctly

---

### Task 4.2: Add State Management to ShowcaseTagBar
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 4.1

**Subtasks:**
- [ ] Add state: `tagCounts` (object with 5 tag types, default 0)
- [ ] Add state: `userTags` (Set of applied tags)
- [ ] Add state: `loading` (boolean)
- [ ] Initialize states in component

**Acceptance Criteria:**
- States defined
- Initial values correct
- No TypeScript/prop-types errors

---

### Task 4.3: Implement Tag Data Fetching
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 4.2, Task 3.1, Task 3.2

**Subtasks:**
- [ ] Create `fetchTagData` async function inside component
- [ ] Call `getTagCounts(announcementId)` and update tagCounts state
- [ ] Call `getUserTags(announcementId, currentUserId)` and update userTags state
- [ ] Add useEffect to call fetchTagData on mount
- [ ] Add loading state management

**Acceptance Criteria:**
- Tag counts load on component mount
- User's applied tags load on component mount
- Loading state shows during fetch

---

### Task 4.4: Implement Real-Time Subscription
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 4.3

**Subtasks:**
- [ ] Add useEffect for Supabase real-time subscription
- [ ] Subscribe to showcase_feedback table changes filtered by announcementId
- [ ] On INSERT/DELETE event, call fetchTagData to refresh counts
- [ ] Return cleanup function to unsubscribe on unmount
- [ ] Test with multiple browser tabs

**Acceptance Criteria:**
- Real-time updates working
- Tag counts update immediately when tags added/removed
- Subscription cleans up on unmount
- No memory leaks

---

### Task 4.5: Implement Tag Button Click Handler
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 4.3, Task 3.3, Task 3.4

**Subtasks:**
- [ ] Create `handleTagClick(tagType)` async function
- [ ] Check if user has already applied this tag (userTags.has(tagType))
- [ ] If applied: call removeTag, update userTags state
- [ ] If not applied: call applyTag, update userTags state
- [ ] Show loading state during operation
- [ ] Show toast on error (use existing toast system from UserPortal)
- [ ] Prevent self-tagging by checking authorId

**Acceptance Criteria:**
- Clicking unapplied tag adds it
- Clicking applied tag removes it (toggle)
- Self-tagging shows error toast
- Validation errors show appropriate messages
- Loading state prevents double-clicks

---

### Task 4.6: Render Tag Buttons with Styling
**Status:** Not Started  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 4.5

**Subtasks:**
- [ ] Map over FEEDBACK_TAGS to render buttons
- [ ] Display emoji, count, and label for each tag
- [ ] Apply `.tag-button` base styles
- [ ] Apply `.applied` class if userTags.has(tagType)
- [ ] Apply `.disabled` class if currentUserId === authorId
- [ ] Use fixed order (no sorting): Effort, Creative, Technique, Style, Impact
- [ ] Format display: "👏 12 Effort • 💡 8 Creative • ..." with separators
- [ ] Add hover effects
- [ ] Make responsive (wrap on mobile)

**Acceptance Criteria:**
- All 5 tags display in fixed order
- Counts show correctly
- Applied tags highlighted
- Self-tag buttons disabled
- Hover effects work
- Responsive on mobile

---

### Task 4.7: Add ShowcaseTagBar CSS
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 4.6

**Subtasks:**
- [ ] Add CSS to `capstone-react/src/index.css` or component-specific stylesheet
- [ ] Style `.tag-button` (base state)
- [ ] Style `.tag-button:hover`
- [ ] Style `.tag-button.applied` with glow effect
- [ ] Style `.tag-button.disabled`
- [ ] Add responsive media queries for mobile
- [ ] Use CSS custom properties for tag colors

**Acceptance Criteria:**
- Buttons styled per design spec
- Hover effects smooth (0.2s transition)
- Applied state has colored border + glow
- Disabled state grayed out
- Mobile-responsive

---

## Phase 5: Showcase Post Creation

### Task 5.1: Add Showcase Option to Post Type Selector
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 2.1

**Subtasks:**
- [ ] Locate post creation modal/form in UserPortal.jsx
- [ ] Find post type selector dropdown/radio buttons
- [ ] Add conditional logic: if (community.category === 'hobby'), show 'showcase' option
- [ ] Use POST_TYPE.showcase for label and icon
- [ ] Ensure post_type='showcase' is set when form submitted

**Acceptance Criteria:**
- Showcase option visible in hobby communities only
- Showcase option hidden in academic/project/social communities
- Selecting showcase sets correct post_type value
- Form submission works

---

### Task 5.2: Test Showcase Post Creation
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 5.1

**Subtasks:**
- [ ] Create test hobby community if needed
- [ ] Create showcase post with title and content
- [ ] Verify post appears in feed
- [ ] Verify post_type='showcase' in database
- [ ] Try creating showcase in non-hobby community (should not show option)

**Acceptance Criteria:**
- Can create showcase posts in hobby communities
- Cannot create showcase posts in other categories
- Posts save with correct post_type

---

## Phase 6: Showcase Post Display

### Task 6.1: Modify AnnouncementCard to Detect Showcase
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 2.1

**Subtasks:**
- [ ] Open AnnouncementCard component in UserPortal.jsx
- [ ] Add check: `const isShowcase = a.post_type === 'showcase'`
- [ ] Add conditional CSS class to card: `${isShowcase ? 'showcase' : ''}`
- [ ] Add showcase badge in header if isShowcase

**Acceptance Criteria:**
- Showcase posts detected correctly
- CSS class applied
- Badge displays

---

### Task 6.2: Add Showcase Visual Frame Styling
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 6.1

**Subtasks:**
- [ ] Add CSS for `.announcement-card.showcase`
- [ ] Apply orange border (2px solid #f59e0b)
- [ ] Apply gradient background (rgba(245, 158, 11, 0.05) to 0.02)
- [ ] Apply glow box-shadow (0 0 20px rgba(245, 158, 11, 0.15))
- [ ] Style `.showcase-badge` with orange theme

**Acceptance Criteria:**
- Showcase posts visually distinct
- Orange border and glow visible
- Badge styled correctly
- Matches design spec

---

### Task 6.3: Integrate ShowcaseTagBar into AnnouncementCard
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 6.1, Task 4.7

**Subtasks:**
- [ ] Import ShowcaseTagBar component
- [ ] Add conditional render: if isShowcase, render ShowcaseTagBar
- [ ] Pass all required props: announcementId, authorId, communityId, currentUserId, currentUserName
- [ ] Get communityId from announcement object
- [ ] Get currentUserName from user context
- [ ] Position TagBar below post content, above comments

**Acceptance Criteria:**
- ShowcaseTagBar renders for showcase posts only
- All props passed correctly
- TagBar positioned correctly in layout
- No render errors

---

## Phase 7: Testing & Validation

### Task 7.1: Manual Testing - Happy Path
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** All previous tasks

**Subtasks:**
- [ ] Create hobby community
- [ ] Create showcase post
- [ ] Apply all 5 feedback tags as different user
- [ ] Verify counts display correctly
- [ ] Verify tags toggle on/off
- [ ] Verify real-time updates across tabs
- [ ] Verify notification received by post author

**Acceptance Criteria:**
- Full workflow works end-to-end
- Real-time updates work
- Notifications delivered

---

### Task 7.2: Manual Testing - Validation & Error Cases
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 7.1

**Subtasks:**
- [ ] Try to tag own showcase (should show error)
- [ ] Try to create showcase in non-hobby community (option should not appear)
- [ ] Try to tag as non-member (should show error - manually test via console)
- [ ] Apply same tag twice (should toggle off)

**Acceptance Criteria:**
- Self-tagging blocked with error message
- Non-members blocked
- Toggle behavior works
- All validation working

---

### Task 7.3: Manual Testing - UI/UX Polish
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 7.2

**Subtasks:**
- [ ] Test on mobile viewport (320px width)
- [ ] Verify tag buttons wrap correctly
- [ ] Test hover effects
- [ ] Verify applied tag highlight visible
- [ ] Test loading states
- [ ] Check visual frame displays correctly

**Acceptance Criteria:**
- Mobile responsive
- All interactions smooth
- Visual polish matches design

---

### Task 7.4: Cross-Browser Testing
**Status:** Not Started  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 7.3

**Subtasks:**
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Test in Edge
- [ ] Verify emojis render correctly in all browsers

**Acceptance Criteria:**
- Feature works in all major browsers
- No browser-specific bugs
- Emojis display correctly

---

## Phase 8: Documentation & Cleanup

### Task 8.1: Update Implementation Status Document
**Status:** Not Started  
**Estimated Time:** 15 minutes  
**Dependencies:** All testing complete

**Subtasks:**
- [ ] Update IMPLEMENTATION_STATUS.md
- [ ] Mark Hobby Showcase as completed
- [ ] Document any known issues or future enhancements
- [ ] Update testing checklist

**Acceptance Criteria:**
- Documentation updated
- Status accurate

---

### Task 8.2: Code Review & Cleanup
**Status:** Not Started  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 8.1

**Subtasks:**
- [ ] Remove console.log statements
- [ ] Add JSDoc comments to functions
- [ ] Check for unused imports
- [ ] Verify error handling is consistent
- [ ] Check for accessibility (ARIA labels on buttons)

**Acceptance Criteria:**
- Code clean and commented
- No debug statements
- Accessibility considered

---

## Summary

**Total Estimated Time:** ~9-10 hours  
**Total Tasks:** 29 tasks across 8 phases  
**Dependencies:** Sequential phases, some parallel tasks within phases

**Critical Path:**
1. Database setup (Phase 1)
2. Utility functions (Phase 3)
3. ShowcaseTagBar component (Phase 4)
4. Integration (Phase 6)
5. Testing (Phase 7)

**Risk Areas:**
- Real-time subscription debugging
- Validation edge cases
- Mobile responsive layout
- Cross-browser emoji rendering
