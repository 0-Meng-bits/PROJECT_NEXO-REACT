# Future Feature Ideas

These are planned enhancements for later implementation.

## Quick Overview

| # | Feature | Description | Difficulty | Value |
|---|---------|-------------|------------|-------|
| 1 | **Profile Customization Shop** | Users spend trust points to buy themes, badges, backgrounds for their profiles (Friendster-style) | 3/5 | High |
| 2 | **Storage Usage Monitor** | Admin dashboard shows storage used/available with visual progress bar | 2/5 | Medium |
| 3 | **Voice & Video Calls** | External links now (free), native WebRTC if funded ($50/month) | 1/5 (external)<br>5/5 (native) | Medium |
| 4 | **Enhanced Channel Types** | Different UIs for gallery, files, notes, task channels using existing infrastructure | 3/5 | High |
| 5 | **Advanced Moderation** | Auto-detection for toxic content, spam patterns, sentiment analysis | 4/5 | Low |

**Difficulty Scale:**
- 1/5 = Very Easy (few hours)
- 2/5 = Easy (1-2 days)
- 3/5 = Medium (3-5 days)
- 4/5 = Hard (1-2 weeks)
- 5/5 = Very Hard (2+ weeks)

---

## 1. Profile Customization Shop (Friendster-Style)

### Concept
Users spend **trust points** to buy profile customizations - no real money needed!

### What Users Can Buy

**Profile Themes** (5-10 points)
- Different color schemes
- Background patterns
- Custom layouts

**Badges/Icons** (2-5 points)
- Achievement badges
- Special icons next to name
- Profile decorations

**Profile Backgrounds** (3-8 points)
- Gradient styles
- Pattern backgrounds
- Image frames

**Username Colors** (3 points)
- Different name colors in chat
- Gradient usernames

**Profile Music/Sound** (10 points)
- Profile background music (like old Friendster!)
- Sound effects

### Benefits
✅ Gamification - encourages positive behavior  
✅ No real money - keeps it free for students  
✅ Engagement - gives users something to work towards  
✅ Community building - rewards helpful members  
✅ Nostalgia factor - Friendster-style customization is fun!

### Database Structure

**shop_items table:**
- id, name, description, type (theme/badge/background/color)
- price (in trust points)
- preview_url, css_data, is_active

**user_purchases table:**
- user_id, item_id, purchased_at

**user_profile_settings table:**
- user_id, active_theme, active_badge, active_background, active_name_color

### Features to Build
1. Shop page - browse and buy items
2. Preview system - see before buying
3. Inventory - view owned items
4. Profile customization panel - apply items
5. Point balance display - show current points

---

## 2. Storage Usage Monitor (Admin Panel)

### Concept
Display available storage space in admin dashboard - like phone storage display.

### Features
- Total storage used vs. available
- Breakdown by type (images, videos, voice messages)
- Visual progress bar
- Alerts when reaching limit

### Implementation
- Query Supabase storage bucket usage
- Display in admin dashboard
- Set thresholds for warnings

---

## 3. Voice & Video Calls

### Current Approach
External link integration (Google Meet/Zoom) - free option.

### Future Enhancement (If Funded)
Native WebRTC integration with Daily.co or Agora (~$50/month for 10,000 minutes).

### Implementation Notes
- Option A (Current): Direct links to third-party apps - free
- Option B (Funded): Native in-app calls - requires payment
- Panel can be told: "If funded, we'll implement native calling"

---

## 4. Enhanced Channel Types

### Concept
Different UI per channel type using existing channel infrastructure.

### Channel Types

**Gallery Channels**
- Grid view for images
- Lightbox for viewing
- Upload multiple at once

**File Channels**
- File manager UI
- Download tracking
- File versioning

**Notes Channels**
- Rich text editor
- Collaborative editing
- Version history

**Task Channels**
- Kanban board
- Task assignments
- Due dates

### Implementation
- Add `channel_type` column to `channels` table
- Values: 'chat' (default), 'gallery', 'files', 'notes', 'tasks'
- Render different UI based on type
- Reuse existing message/post infrastructure

### Why This Works
Channels already exist - we just adjust the UI based on type. No redundancy with existing features!

---

## 5. Advanced Moderation Features

### Auto-Moderation
- Sentiment analysis for toxic messages
- Automatic warning for repeated violations
- Pattern detection for spam

### Appeal System
Already implemented in trust points system - users can appeal warnings.

### Trust Point Recovery
- Automatic point recovery over time (1 point per month of good behavior)
- Admin can manually restore points

---

## Implementation Priority

**High Priority** (Adds Most Value):
1. Profile Customization Shop - gamification + engagement
2. Enhanced Channel Types - makes circles more versatile

**Medium Priority** (Nice to Have):
3. Storage Monitor - admin tool
4. Voice/Video Calls - depends on funding

**Low Priority** (Already Functional):
5. Advanced Moderation - basic system works

---

## Notes for Panel Presentation

- **Profile Shop**: Free alternative to paid customization, encourages positive behavior
- **Channel Types**: Minimal code, maximum versatility for different circle needs
- **Calls**: External links now, native if funded (~$50/month)
- All features designed to enhance engagement without requiring payment from students


---

## Database Schema Changes

### NEW TABLES TO ADD

#### 1. Profile Customization Shop

**shop_items**
```sql
CREATE TABLE shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music')),
  price int NOT NULL DEFAULT 0,
  preview_url text,
  css_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**user_purchases**
```sql
CREATE TABLE user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  item_id uuid REFERENCES shop_items(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);
```

**user_profile_settings**
```sql
CREATE TABLE user_profile_settings (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  active_theme uuid REFERENCES shop_items(id),
  active_badge uuid REFERENCES shop_items(id),
  active_background uuid REFERENCES shop_items(id),
  active_name_color uuid REFERENCES shop_items(id),
  active_music uuid REFERENCES shop_items(id),
  updated_at timestamptz DEFAULT now()
);
```

#### 2. Storage Usage Monitor
**No new tables needed** - uses Supabase storage API queries

#### 3. Voice & Video Calls
**No new tables needed** - external links stored in existing tables  
(Or if native: use existing `messages` table with `message_type = 'call'`)

#### 4. Enhanced Channel Types

**MODIFY existing channels table:**
```sql
ALTER TABLE channels 
ADD COLUMN channel_type text DEFAULT 'chat' 
CHECK (channel_type IN ('chat', 'gallery', 'files', 'notes', 'tasks'));
```

**task_items** (for task channels)
```sql
CREATE TABLE task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES accounts(id),
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date timestamptz,
  created_by uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 5. Advanced Moderation

**moderation_logs**
```sql
CREATE TABLE moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('message', 'post', 'comment')),
  user_id uuid REFERENCES accounts(id),
  detected_issue text,
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  auto_action text,
  reviewed_by uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now()
);
```

**spam_patterns**
```sql
CREATE TABLE spam_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id),
  pattern_type text NOT NULL,
  occurrences int DEFAULT 1,
  last_occurred timestamptz DEFAULT now(),
  flagged boolean DEFAULT false
);
```

---

## Summary for ERD

### New Tables to Add (7 total)

1. ✅ **shop_items** - available customization items
2. ✅ **user_purchases** - items users own
3. ✅ **user_profile_settings** - active customizations
4. ✅ **task_items** - tasks for task channels
5. ✅ **moderation_logs** - auto-moderation records
6. ✅ **spam_patterns** - spam detection tracking

### Modified Existing Tables (1)

1. ✅ **channels** - add `channel_type` column

### No Changes Needed (2 features)

- Storage Monitor - uses API only
- Voice/Video Calls - uses existing infrastructure

---

## ERD Update Checklist

**Add these entities to your ERD:**

- [ ] shop_items (connects to user_purchases)
- [ ] user_purchases (connects accounts → shop_items)
- [ ] user_profile_settings (one-to-one with accounts)
- [ ] task_items (connects to channels, accounts)
- [ ] moderation_logs (connects to accounts)
- [ ] spam_patterns (connects to accounts)

**Update existing:**

- [ ] channels table - add channel_type field

**Relationships:**

- accounts → user_purchases (one-to-many)
- shop_items → user_purchases (one-to-many)
- accounts → user_profile_settings (one-to-one)
- channels → task_items (one-to-many)
- accounts → task_items (assigned_to, created_by)
- accounts → moderation_logs (user_id, reviewed_by)
- accounts → spam_patterns (one-to-many)
