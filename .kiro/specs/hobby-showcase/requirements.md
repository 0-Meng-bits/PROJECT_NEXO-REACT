# Requirements Document

## Introduction

The Hobby Showcase feature enables creators in hobby communities to receive structured, actionable feedback on their work through preset feedback tags. This addresses the current limitation where feedback is limited to generic comments that don't help creators identify what aspects of their work resonate most with viewers.

## Glossary

- **Showcase_Post**: A special post type in the announcements table where creators mark their work for structured feedback
- **Feedback_Tag**: A preset emoji-label pair that users can apply to showcase posts to indicate specific qualities (Effort, Creative, Technique, Style, Impact)
- **Tag_Count**: The aggregated number of times each feedback tag has been applied to a showcase post
- **Hobby_Community**: A community with category='hobby' where creators share artistic work
- **Creator**: The user who authors a showcase post
- **Viewer**: Any user who views and provides feedback on a showcase post
- **Post_Type**: A field in the announcements table indicating the type of post (general, announcement, poll, event, shoutout, showcase)

## Requirements

### Requirement 1: Showcase Post Creation

**User Story:** As a creator in a hobby community, I want to mark my post as a showcase, so that I can receive structured feedback on my work.

#### Acceptance Criteria

1. WHEN a user creates a post in a hobby community, THE System SHALL provide an option to mark it as "showcase" post type
2. WHERE category='hobby', WHEN a user selects showcase post type, THE System SHALL store post_type='showcase' in the announcements table
3. WHEN a showcase post is created, THE System SHALL initialize empty feedback tag counts for all five tag types
4. THE Showcase_Post SHALL support all standard post fields (title, content, author_id, community_id, created_at)
5. WHERE category IN ('academic', 'project', 'social'), THE System SHALL NOT display the showcase post type option

### Requirement 2: Visual Distinction of Showcase Posts

**User Story:** As a viewer browsing a hobby community, I want to immediately identify showcase posts, so that I know which posts are seeking structured feedback.

#### Acceptance Criteria

1. WHEN displaying a showcase post, THE System SHALL render a visual frame distinct from other post types
2. WHEN displaying a showcase post, THE System SHALL show a "Showcase" badge with icon
3. THE Visual_Frame SHALL use styling consistent with the post type configuration (unique color and icon for showcase type)
4. WHEN displaying showcase posts in a feed, THE System SHALL maintain visual distinction across all viewport sizes

### Requirement 3: Feedback Tag Application

**User Story:** As a viewer, I want to give structured feedback using preset tags, so that creators understand what aspects of their work resonated with me.

#### Acceptance Criteria

1. WHEN viewing a showcase post, THE System SHALL display five feedback tag options: Effort (👏), Creative (💡), Technique (🎯), Style (🎨), Impact (🔥)
2. WHEN a user clicks a feedback tag, THE System SHALL increment that tag's count for the showcase post
3. WHEN a user clicks a feedback tag they already applied, THE System SHALL decrement that tag's count and remove their tag application
4. THE System SHALL allow users to apply multiple different feedback tags to the same showcase post
5. WHEN a user applies a feedback tag, THE System SHALL record the user_id and tag_type for attribution
6. THE System SHALL prevent users from applying the same feedback tag multiple times to the same post

### Requirement 4: Feedback Tag Aggregation and Display

**User Story:** As a creator, I want to see aggregate feedback tag counts on my showcase post, so that I understand which aspects of my work resonated most with viewers.

#### Acceptance Criteria

1. WHEN displaying a showcase post, THE System SHALL show aggregated counts for each feedback tag type
2. THE Tag_Display SHALL show tags in fixed order: Effort, Creative, Technique, Style, Impact
3. WHEN a tag has zero applications, THE System SHALL still display that tag option with count of 0
4. THE Tag_Display SHALL format as "👏 12 Effort • 💡 8 Creative • 🎯 5 Technique • 🎨 3 Style • 🔥 2 Impact"
5. WHEN tag counts update, THE System SHALL reflect changes in real-time without requiring page refresh

### Requirement 5: Feedback Tag Validation

**User Story:** As a system, I need to validate feedback tag operations, so that data integrity is maintained and users cannot manipulate the system.

#### Acceptance Criteria

1. WHEN a user attempts to apply a feedback tag, THE System SHALL verify the user is a member of the community
2. WHEN a user attempts to apply a feedback tag, THE System SHALL verify the announcement exists and post_type='showcase'
3. WHEN a user attempts to apply an invalid tag_type, THE System SHALL return an error message
4. THE System SHALL enforce tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')
5. WHEN a user attempts to apply feedback to their own showcase post, THE System SHALL prevent the operation and show a message "You cannot tag your own showcase"

### Requirement 6: Showcase Post Notifications (Simple)

**User Story:** As a creator, I want to receive a notification when users give feedback on my showcase, so that I stay engaged with the community response.

#### Acceptance Criteria

1. WHEN a user applies a feedback tag to a creator's showcase post, THE System SHALL create a notification for the creator
2. THE Notification SHALL include the user's name and the tag type applied
3. THE Notification SHALL include a link to the showcase post
4. WHEN a user removes their feedback tag, THE System SHALL NOT create a notification
5. THE System SHALL create individual notifications for each tag application (batching deferred to v2)

## Future Enhancements (Deferred to v2)

### Attribution View
- Allow creators to see which specific users applied each feedback tag type
- Display user avatars and names grouped by tag type
- Visible only to post creator

### Notification Batching
- Batch notifications within 5-minute windows to prevent spam
- Aggregate multiple tag applications into summary notifications
- Requires delayed job queue or pending notification state

### Showcase Analytics Dashboard
- Profile page showing creator's showcase posts sorted by engagement
- Total feedback count aggregation across all tags
- Pagination support for showcase history
- Breakdown of tag counts per post

### Requirement 7: Category-Based Feature Gating

**User Story:** As a system administrator, I want showcase posts available only in hobby communities, so that the feature is used in its intended context.

#### Acceptance Criteria

1. WHEN checking if showcase post type is available, THE System SHALL verify community category equals 'hobby'
2. WHERE community category is NOT 'hobby', THE System SHALL NOT display showcase as a post type option
3. WHERE community category is NOT 'hobby', THE System SHALL NOT allow creation of showcase posts via API
4. WHEN a showcase post somehow exists in a non-hobby community, THE System SHALL render it as a general post type

### Requirement 8: Feedback Tag Storage

**User Story:** As a system, I need to persistently store feedback tag applications, so that tag counts and attributions remain accurate over time.

#### Acceptance Criteria

1. THE System SHALL create a showcase_feedback table with fields: id, announcement_id, user_id, tag_type, created_at
2. WHEN a user applies a feedback tag, THE System SHALL insert a record with the user_id, announcement_id, and tag_type
3. WHEN a user removes their feedback tag, THE System SHALL delete the corresponding record
4. THE System SHALL enforce a unique constraint on (announcement_id, user_id, tag_type) to prevent duplicate tag applications
5. WHEN querying tag counts, THE System SHALL aggregate from the showcase_feedback table grouped by announcement_id and tag_type

### Requirement 9: Feedback Tag Validation

**User Story:** As a system, I need to validate feedback tag operations, so that data integrity is maintained and users cannot manipulate the system.

#### Acceptance Criteria

1. WHEN a user attempts to apply a feedback tag, THE System SHALL verify the user is a member of the community
2. WHEN a user attempts to apply a feedback tag, THE System SHALL verify the announcement exists and post_type='showcase'
3. WHEN a user attempts to apply an invalid tag_type, THE System SHALL return an error message
4. THE System SHALL enforce tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')
5. WHEN a user attempts to apply feedback to their own showcase post, THE System SHALL prevent the operation and show a message "You cannot tag your own showcase"

### Requirement 9: Showcase Post Notifications

**User Story:** As a creator, I want to receive notifications when users give feedback on my showcase, so that I stay engaged with the community response.

#### Acceptance Criteria

1. WHEN a user applies the first feedback tag to a creator's showcase post, THE System SHALL create a notification for the creator
2. THE Notification SHALL include the user's name and the tag type applied
3. WHEN multiple users apply tags within a 5-minute window, THE System SHALL batch notifications to prevent spam
4. THE Notification SHALL include a link to the showcase post
5. WHEN a user removes their feedback tag, THE System SHALL NOT create a notification

### Requirement 10: Showcase Post Analytics Query

**User Story:** As a creator, I want to view my showcase posts sorted by feedback engagement, so that I can identify which works generated the most response.

#### Acceptance Criteria

1. WHEN a creator views their profile showcase history, THE System SHALL display showcase posts ordered by total feedback tag count
2. THE System SHALL calculate total feedback as the sum of all tag counts for each showcase post
3. WHEN displaying showcase history, THE System SHALL show the breakdown of tag counts for each post
4. THE System SHALL support pagination when displaying showcase history (10 posts per page)
5. WHEN a showcase post has zero feedback tags, THE System SHALL still include it in the history with count of 0
