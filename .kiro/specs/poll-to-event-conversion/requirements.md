# Requirements Document: Poll-to-Event Conversion

## Introduction

The Poll-to-Event Conversion feature streamlines activity coordination in social communities by automatically creating calendar events from poll results. This addresses the current friction where poll results require manual event creation, leading to delays and sometimes incomplete follow-through. The feature leverages existing poll and event infrastructure to create a seamless voting-to-scheduling workflow.

## Glossary

- **Social_Community**: A community with category='social' where members coordinate activities and events
- **Poll_Post**: An existing post type (post_type='poll') in the announcements table with poll_options and poll_votes stored as JSONB
- **Event_Metadata**: Optional fields (date, time, location) stored in a separate event_metadata JSONB column on the poll post, distinct from poll_options
- **Winning_Option**: The poll option with the most votes at poll close time
- **Generated_Event**: A record in the campus_events table automatically created from a poll's winning option
- **Community_Leader**: A user with rank_level > 0 in a community's memberships table
- **Poll_Voter**: Any user who cast a vote in a poll (recorded in poll_votes JSONB)

## Requirements

### Requirement 1: Poll Event Metadata Fields

**User Story:** As a member of a social community, I want to add event details when creating a poll, so that the winning option can automatically become a calendar event.

#### Acceptance Criteria

1. WHERE category='social', WHEN creating a poll post, THE System SHALL provide optional fields for event date, event time, and location
2. WHEN a user provides event metadata, THE System SHALL store it in a separate event_metadata JSONB column on the announcements row (not nested inside poll_options)
3. THE Event_Date_Field SHALL use a date picker input format
4. THE Event_Time_Field SHALL use a time picker input format
5. THE Location_Field SHALL accept text input with maximum length of 200 characters
6. WHERE category IN ('academic', 'project', 'hobby'), WHEN creating a poll, THE System SHALL NOT display event metadata fields
7. WHEN a user creates a poll without event metadata, THE System SHALL allow poll creation but NOT enable automatic event generation

---

### Requirement 2: Manual Poll Closure

**User Story:** As a community leader, I want to manually close a poll, so that I can trigger event creation when consensus is reached.

#### Acceptance Criteria

1. WHEN a community leader views an active poll, THE System SHALL display a "Close Poll & Create Event" button
2. WHEN a community leader clicks the close button, THE System SHALL verify the user's rank_level is greater than 0
3. WHEN poll closure is requested, THE System SHALL mark the poll as closed immediately and store the close timestamp
4. WHEN a poll is closed, THE System SHALL prevent new vote submissions
5. WHERE a poll has event metadata AND is manually closed, THE System SHALL trigger event generation
6. WHERE a poll has no event metadata, THE System SHALL close the poll but NOT generate an event

**Note:** v1 supports manual closure only. No background job or scheduler is used — see Future Enhancements for automatic time-based closure.

---

### Requirement 3: Winning Option Determination

**User Story:** As a system, I need to identify the poll option with the most votes, so that the correct event details are used for generation.

#### Acceptance Criteria

1. WHEN a poll closes, THE System SHALL count votes for each poll option from the poll_votes JSONB
2. THE System SHALL identify the option with the highest vote count as the winning option
3. WHEN there is a tie in vote counts, THE System SHALL select the option that appears first in the poll_options array
4. WHEN a poll has zero votes, THE System SHALL select the first option as the winning option
5. THE System SHALL use the winning option's text as the generated event title

---

### Requirement 4: Automatic Event Generation

**User Story:** As a poll voter, I want the winning poll option to automatically become a calendar event, so that I can RSVP and attend without additional coordination.

#### Acceptance Criteria

1. WHEN a poll with event metadata closes, THE System SHALL create a record in the campus_events table
2. THE Generated_Event SHALL use the winning option text as the title
3. THE Generated_Event SHALL use the poll's event_date metadata as start_date
4. THE Generated_Event SHALL use the poll's event_time metadata as start_time
5. THE Generated_Event SHALL use the poll's location metadata as location
6. THE Generated_Event SHALL set poster_id to the poll creator's user_id
7. THE Generated_Event SHALL set poster_name to the poll creator's full_name
8. THE Generated_Event SHALL set poster_type to the poll creator's user_type
9. THE Generated_Event SHALL set category to 'social'
10. THE Generated_Event SHALL set is_official to false
11. THE Generated_Event SHALL generate a description in format: "This event was created from the poll '[Poll Title]' - winning option: '[Option Text]'"

---

### Requirement 5: Event Generation Notification

**User Story:** As a poll voter, I want to be notified when the event is created from the poll, so that I know the decision is final and can add it to my calendar.

#### Acceptance Criteria

1. WHEN an event is generated from a poll, THE System SHALL create notifications for all users who voted in the poll
2. THE Notification SHALL include the event title and link to the generated event
3. THE Notification message SHALL use format: "The poll '[Poll Title]' has closed! Event created: [Event Title]"
4. THE System SHALL set notification type to 'event_from_poll'
5. THE System SHALL NOT notify users who did not vote in the poll

---

### Requirement 6: Poll Event Reference

**User Story:** As a user viewing a closed poll, I want to see which event was generated, so that I can navigate directly to the event details.

#### Acceptance Criteria

1. WHEN displaying a closed poll that generated an event, THE System SHALL show a visual indicator that event was created
2. THE Indicator SHALL include a link to the generated event with text "View Event"
3. THE System SHALL store the generated event_id in the event_metadata field as generated_event_id
4. WHEN a user clicks the event link, THE System SHALL navigate to the campus_events view showing the generated event
5. WHERE a poll closed without generating an event, THE System SHALL NOT display the event indicator

---

### Requirement 7: Event Metadata Validation

**User Story:** As a system, I need to validate event metadata before creating events, so that generated events contain valid date, time, and location information.

#### Acceptance Criteria

1. WHEN validating event date, THE System SHALL ensure the date is not in the past
2. WHEN validating event time, THE System SHALL ensure it follows HH:MM format in 24-hour notation
3. WHEN validating location, THE System SHALL ensure it is not empty and does not exceed 200 characters
4. WHEN event metadata is invalid at poll close time, THE System SHALL close the poll but NOT generate an event
5. WHEN event generation fails due to invalid metadata, THE System SHALL create a notification for the poll creator explaining the validation failure

---

### Requirement 8: Poll Display Enhancement

**User Story:** As a user viewing polls in a social community, I want to see which polls will generate events, so that I understand the impact of my vote.

#### Acceptance Criteria

1. WHEN displaying a poll with event metadata, THE System SHALL show an "Event Poll" badge
2. THE Event_Poll_Badge SHALL display the event date and location beneath the poll options
3. WHEN displaying vote counts, THE System SHALL show current vote distribution for each option
4. WHEN a poll is closed, THE System SHALL display "Poll Closed" status and the winning option

---

### Requirement 9: Date/Time Conversion

**User Story:** As a system, I need to convert poll event metadata into database-compatible formats, so that event generation stores valid dates and times.

#### Acceptance Criteria

1. WHEN generating an event, THE System SHALL convert the stored date string to SQL date format (YYYY-MM-DD)
2. WHEN generating an event, THE System SHALL convert the stored time string to SQL time format (HH:MM:SS)
3. WHEN conversion fails for either field, THE System SHALL treat this as a validation failure per Requirement 7.4–7.5

---

## Future Enhancements (Deferred to v2)

### Automatic Time-Based Poll Closure

Poll closes on its own after a set duration (e.g., 48 hours) without requiring a community leader to click "Close"

**Recommended v2 approach:** Lazy check — when any user loads a poll past its stored close_time, the app closes it and triggers event generation at that moment, rather than running a background job/scheduler.

**Deferred because:** It requires either a scheduled job (new infrastructure) or careful lazy-check logic not yet used elsewhere in the system.

### Countdown Display ("Closes in X hours")

Requires a real closing deadline to be meaningful; deferred alongside automatic closure above.

### Timezone Handling in Event Metadata

v1 assumes all events use a single implicit timezone (no per-event timezone field). Deferred until multi-timezone use cases arise.

---

## Summary of Changes

### Issue → Fix

1. **Req 10's formal parser/round-trip spec** → Reduced to plain Requirement 9 — convert two strings to SQL format, treat failure as existing validation error
2. **Ambiguous automatic vs. manual closure** → Resolved to manual-only for v1 (Req 2); automatic closure moved to Future Enhancements with the lazy-check approach specified
3. **Metadata nested in poll_options vs. sibling field** → Resolved to sibling event_metadata JSONB column — cleaner queries, doesn't mix vote-option data with event data
4. **Missing deferred-work section** → Added, matching Hobby's pattern
