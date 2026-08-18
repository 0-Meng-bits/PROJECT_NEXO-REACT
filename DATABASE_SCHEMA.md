# NEXO Connect - Database Schema Documentation

## Core Tables (New Schema)

### **accounts** (replaces profiles core identity)
Primary identity table for all users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique user identifier |
| ctu_id | text | UNIQUE, NOT NULL | Student/faculty ID (formerly student_id) |
| full_name | text | NOT NULL | User's full name |
| email | text | UNIQUE, NOT NULL | Email address |
| user_type | text | DEFAULT 'Student' | User role (Student/Faculty/Admin) |
| created_at | timestamptz | DEFAULT now() | Account creation timestamp |

**Relationships:**
- One-to-one with `account_status`
- One-to-one with `account_details`
- One-to-many with `communities` (creator_id)
- One-to-many with `memberships` (user_id)
- One-to-many with `announcements` (author_id)
- One-to-many with `audition_responses` (applicant_id)
- One-to-many with `user_warnings` (user_id)
- One-to-many with `reports` (reporter_id, reported_user_id)

---

### **account_status**
Tracks verification, moderation, and trust state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, REFERENCES accounts(id) | Links to accounts.id |
| is_verified | boolean | DEFAULT false | Email/ID verification status |
| is_banned | boolean | DEFAULT false | Ban status |
| suspended_until | timestamptz | | Suspension end date (if suspended) |
| warning_count | int | DEFAULT 0 | Number of warnings received |
| trust_points | int | DEFAULT 10 | Trust score (decreases with warnings) |
| onboarding_complete | boolean | DEFAULT false | Onboarding completion flag |

---

### **account_details**
Profile information and preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, REFERENCES accounts(id) | Links to accounts.id |
| department | text | | Academic department |
| course | text | | Course/program (BSIT, BSCS, etc.) |
| year_level | text | | Year level (1st Year, 2nd Year, etc.) |
| interests | text[] | | Array of user interests |
| avatar_url | text | | Profile picture URL |
| cover_url | text | | Profile cover photo URL |
| id_photo_url | text | | Verification ID photo URL |
| id_verified | boolean | DEFAULT false | ID verification status |
| last_seen | timestamptz | | Last activity timestamp (for online status) |

---

## Community & Social Tables

### **communities**
Student organizations and circles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRI