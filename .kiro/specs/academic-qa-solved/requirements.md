# Requirements Document: Academic Q&A with Solved Marking

## Introduction
The Academic Q&A feature gives academic communities a dedicated question post type where members can ask questions and the original poster (or community creator) can mark a specific reply as the accepted solution. This addresses the core knowledge-exchange problem specific to academic circles: distinguishing answered questions from unanswered ones so members can find working solutions quickly.

This builds on the existing `announcements` table (posts) and `post_comments` table (replies) by adding a `post_type='question'` variant and a `solution_comment_id` column that points to the accepted answer.

## Glossary
- **Question Post**: An announcement with `post_type='question'`, created in a community with `category='academic'`
- **Solution**: A `post_comments` row whose `id` matches the question's `solution_comment_id`
- **OP (Original Poster)**: The user referenced by `announcements.author_id`
- **Community Creator**: The user referenced by `communities.creator_id`
- **Authorized Solver**: Either the OP (`auth.uid() = announcements.author_id`) or the community creator (`auth.uid() = communities.creator_id`)
- **Unsolved**: A question where `solution_comment_id IS NULL`
- **Solved**: A question where `solution_comment_id` points to a valid `post_comments` row

## Requirements

### Requirement 1: Question Post Type
**User Story:** As an academic circle member, I want to post a question, so that I can get help from other members on academic topics.

**Acceptance Criteria:**
- WHERE `community.category = 'academic'`, THE System SHALL display a "Question" option in the post type selector
- WHEN a user creates a post with type "Question", THE System SHALL store `post_type = 'question'` on the `announcements` row
- THE System SHALL NOT display the "Question" post type option in non-academic communities
- WHEN displaying a question post, THE System SHALL render it visually distinct from general posts (e.g. a "Question" badge)

---

### Requirement 2: Solution Marking
**User Story:** As the question author, I want to mark a reply as the accepted solution, so that other members know which answer resolved my question.

**Acceptance Criteria:**
- WHEN a comment exists on a question post, THE System SHALL display a "Mark as Solution" button on each comment
- THE System SHALL only show "Mark as Solution" to the Authorized Solver (OP or community creator)
- WHEN an Authorized Solver marks a comment as solution, THE System SHALL set `announcements.solution_comment_id = post_comments.id`
- THE System SHALL verify the target comment's `announcement_id` matches the question's `id` before accepting the update — a comment from a different post MUST NOT be accepted as a solution
- THE System SHALL enforce this authorization via RLS, checking `auth.uid()` against `announcements.author_id` OR `communities.creator_id` — not a client-supplied user ID
- THE System SHALL permit the community creator to mark/unmark a solution regardless of the OP's current membership status
- THE System SHALL permit the community creator to mark/unmark a solution regardless of the OP's current membership status — creator override is unconditional

---

### Requirement 3: Solution Unmarking (Toggle)
**User Story:** As the question author, I want to unmark a solution, so that I can change which answer is accepted if a better one appears.

**Acceptance Criteria:**
- WHEN a question already has a `solution_comment_id`, THE System SHALL display an "Unmark Solution" button on the current solution comment
- WHEN an Authorized Solver unmarks a solution, THE System SHALL set `announcements.solution_comment_id = NULL`
- THE System SHALL use the same authorization check as marking (Requirement 2) — same RLS policy, same `auth.uid()` check
- WHEN a solution comment is deleted, THE System SHALL automatically revert `solution_comment_id` to NULL via `ON DELETE SET NULL` on the FK constraint

---

### Requirement 4: Solution Display
**User Story:** As an academic circle member, I want to see which reply is the accepted solution, so that I can find the answer without reading all comments.

**Acceptance Criteria:**
- WHEN displaying a solved question, THE System SHALL visually highlight the solution comment (e.g. green border, "✅ Accepted Answer" badge)
- THE System SHALL pin or display the solution comment prominently, regardless of comment order
- WHEN displaying any question post, THE System SHALL show a solved/unsolved status indicator
- WHEN a question is solved, THE System SHALL display how long ago it was solved (e.g. "Solved 2 months ago") derived from `post_comments.created_at` of the solution — no expiry logic, display only

---

### Requirement 5: Unanswered Filter
**User Story:** As an academic circle member, I want to filter for unanswered questions, so that I can help members who haven't received a solution yet.

**Acceptance Criteria:**
- WHERE `community.category = 'academic'`, THE System SHALL display a filter toggle: "All Posts" / "Questions" / "Unanswered"
- WHEN "Unanswered" filter is selected, THE System SHALL show only posts where `post_type = 'question'` AND `solution_comment_id IS NULL`
- WHEN "Questions" filter is selected, THE System SHALL show all question posts regardless of solved status
- THE System SHALL apply this filter client-side on already-loaded posts

---

### Requirement 6: Solution Notification
**User Story:** As a comment author, I want to be notified when my comment is marked as the solution, so that I know my answer was helpful.

**Acceptance Criteria:**
- WHEN a solution is marked, THE System SHALL insert one notification row for the solution comment's `author_id`
- THE System SHALL NOT send a notification when a solution is unmarked
- THE System SHALL NOT send a notification if the OP marks their own comment as solution (self-notification)
- THE notification message SHALL identify the question title and community

---

### Requirement 7: Row-Level Security for Solution Updates
**User Story:** As a system, I need database-level enforcement of solution-marking permissions, so that the rule cannot be bypassed from the browser console.

**Acceptance Criteria:**
- THE System SHALL create an UPDATE policy on `announcements` that restricts updates to `solution_comment_id`
- THE Policy SHALL check that `auth.uid()` matches either `announcements.author_id` OR the `communities.creator_id` for the announcement's community
- THE System SHALL apply this check in both `USING` and `WITH CHECK` clauses
- THE Policy SHALL use a subquery to look up `communities.creator_id` — it MUST NOT rely on a client-supplied value

---

## Schema Changes

### announcements table (ALTER)
```sql
ALTER TABLE announcements
ADD COLUMN solution_comment_id uuid
REFERENCES post_comments(id) ON DELETE SET NULL;
```

**Notes:**
- Nullable: NULL = unsolved, non-null = solved
- `ON DELETE SET NULL`: if the solution comment is deleted, question reverts to unsolved automatically. Comment deletion is confirmed active in the app (`deleteComment` in UserPortal.jsx), so this clause is live, not defensive.
- No separate `is_solved` boolean needed — `solution_comment_id IS NOT NULL` serves as the solved predicate

---

## Future Enhancements (Deferred to v2)
- **Subject tagging**: taxonomy/tag table for categorizing questions by subject (e.g. "Math", "Physics") — deferred, v1 is status-only
- **Upvoting comments**: let members vote on helpful answers — deferred, no vote table exists yet
- **Question search**: full-text search across question titles — deferred, uses existing search infrastructure
