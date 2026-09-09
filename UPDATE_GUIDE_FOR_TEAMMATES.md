# 🔄 Update Guide - Get Latest Features

## For teammates who already have the system running locally

---

## 📥 Step 1: Pull Latest Code

```bash
# Make sure you're in the project root
cd PROJECT_NEXO-REACT

# Pull the latest changes
git pull origin main

# Install any new dependencies
cd capstone-react
npm install
```

---

## 🗄️ Step 2: Run New Database Migrations

Go to your **Supabase Dashboard → SQL Editor** and run these migrations **in order**:

### 1️⃣ Chat Media Support
```
File: supabase/migrations/20260831000000_add_chat_media_support.sql
```
Adds image upload and voice notes to chat messages.

### 2️⃣ Profile Shop (Feature #1)
```
File: supabase/migrations/20260905000000_add_profile_shop.sql
```
Creates the profile customization shop system (themes, badges, colors, backgrounds).

### 3️⃣ Channel Types & Task Board (Feature #2)
```
File: supabase/migrations/20260905100000_add_channel_types.sql
```
Adds task channels with kanban board functionality.

### 4️⃣ Task RLS Fix #1
```
File: supabase/migrations/20260905200000_fix_task_rls.sql
```
Fixes permissions for task board.

### 5️⃣ Task RLS Fix #2
```
File: supabase/migrations/20260905300000_fix_task_rls_v2.sql
```
Final task permission fixes.

### 6️⃣ Avatar Borders
```
File: supabase/migrations/20260906000000_add_avatar_borders.sql
```
Adds avatar border customization items.

### 7️⃣ Waves Background Fix
```
File: supabase/migrations/20260906100000_fix_waves_background.sql
```
Fixes the waves background pattern.

### 8️⃣ Delete Circle Fix
```
File: supabase/migrations/20260906200000_fix_delete_community_cascade.sql
```
Allows circles to be deleted properly.

---

## 📋 Quick Migration Steps

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **+ New Query**
4. Copy the content from each migration file (in the order above)
5. Paste into SQL Editor
6. Click **RUN**
7. Repeat for all 8 migrations

**💡 Tip:** You can open the migration files in your code editor, copy all content, and paste into Supabase SQL Editor.

---

## ▶️ Step 3: Restart the App

```bash
# Stop the current running app (Ctrl+C if running)

# Start both frontend and API server
npm run dev:all
```

---

## ✅ Step 4: Verify New Features Work

### Test Feature #1: Profile Customization
1. Click your profile avatar
2. Click **Profile Shop** button
3. Buy and apply customizations (themes, badges, colors, borders)

### Test Feature #2: Task Boards
1. Create a new channel
2. Select **Type: Tasks**
3. You'll see a kanban board with To Do/In Progress/Done columns
4. Add tasks and drag them around

---

## 🎁 What's New?

### ✨ Feature #1: Profile Customization Shop
- Buy themes, badges, name colors, backgrounds, avatar borders
- Costs Trust Points (minimum 10 TP balance required)
- Customizations show in chat and profiles

### 📋 Feature #2: Task Boards
- Create task-type channels
- Drag-and-drop kanban board
- Organize tasks in To Do → In Progress → Done

### 🖼️ Media Messaging
- Upload images in chat
- Record and send voice notes

### 🔧 Bug Fixes
- Circle auto-membership when approved
- Delete circle now works properly
- Better error handling

---

## 🐛 Troubleshooting

### "Table already exists" error when running migration
- Skip that migration, it's already been run
- Move to the next one

### "Permission denied" errors
- Make sure all RLS fix migrations (steps 4-5) were run successfully

### Shop items not showing
- Verify migration #2 (profile shop) ran successfully
- Check if `shop_items` table exists in your Supabase dashboard

### Port already in use
- Stop any running instances: `Ctrl+C`
- Then run `npm run dev:all` again

---

## 📊 Database Changes Summary

**New Tables:**
- `shop_items` - Customization items for sale
- `user_purchases` - Track user purchases
- `user_profile_settings` - Active customizations per user
- `task_items` - Tasks in kanban boards

**New Columns:**
- `messages.media_url` - Uploaded media files
- `messages.media_type` - Type of media (image/voice)
- `messages.voice_duration` - Voice note length
- `channels.channel_type` - Channel type (chat/tasks/etc)
- `user_profile_settings.active_avatar_border` - Border selection

---

## 🆘 Still Having Issues?

1. Check that all 8 migrations ran successfully (no errors in SQL Editor)
2. Make sure you ran `npm install` after pulling
3. Restart your servers (`npm run dev:all`)
4. Check browser console (F12) for errors
5. Ask in team chat!

---

## ✅ You're Updated!

After following these steps, you'll have all the latest features running locally! 🎉

---

**Questions?** Reach out in the team chat for help!
