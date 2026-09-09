# 🚀 Teammate Setup Guide - Project NEXO

## Prerequisites
- Node.js installed (v18 or higher)
- Git installed
- Supabase project set up
- Code editor (VS Code recommended)

---

## 📥 Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/0-Meng-bits/PROJECT_NEXO-REACT.git
cd PROJECT_NEXO-REACT

# Install dependencies for React app
cd capstone-react
npm install
```

---

## 🗄️ Step 2: Database Setup

### A. Connect to Your Supabase Project

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Run each migration file below **in order**

### B. Run Migrations (IN ORDER!)

Copy and paste each SQL file content into the SQL Editor and click **RUN**:

#### 1️⃣ **Base Schema** (if not already done)
```
Run: COMPLETE_SCHEMA.sql
```
This creates all base tables (accounts, communities, channels, messages, etc.)

#### 2️⃣ **Chat Media Support**
```
Run: supabase/migrations/20260831000000_add_chat_media_support.sql
```
Adds: media_url, media_type, voice_duration to messages table

#### 3️⃣ **Profile Shop** (Feature #1)
```
Run: supabase/migrations/20260905000000_add_profile_shop.sql
```
Adds: shop_items, user_purchases, user_profile_settings tables

#### 4️⃣ **Channel Types & Task Board** (Feature #2)
```
Run: supabase/migrations/20260905100000_add_channel_types.sql
```
Adds: channel_type column, task_items table

#### 5️⃣ **Task RLS Policies** (Feature #2 Fix)
```
Run: supabase/migrations/20260905200000_fix_task_rls.sql
```
Fixes: Row Level Security for task_items

#### 6️⃣ **Task RLS V2** (Feature #2 Fix)
```
Run: supabase/migrations/20260905300000_fix_task_rls_v2.sql
```
Further fixes: Task permissions for leaders and members

#### 7️⃣ **Avatar Borders** (Feature #1 Enhancement)
```
Run: supabase/migrations/20260906000000_add_avatar_borders.sql
```
Adds: active_avatar_border column, border shop items

#### 8️⃣ **Waves Background Fix** (Feature #1 Fix)
```
Run: supabase/migrations/20260906100000_fix_waves_background.sql
```
Fixes: Waves background pattern with proper SVG

#### 9️⃣ **Delete Community CASCADE** (Bug Fix)
```
Run: supabase/migrations/20260906200000_fix_delete_community_cascade.sql
```
Fixes: Delete circle functionality with cascading deletes

---

## 🔐 Step 3: Environment Variables

Create `.env` file in `capstone-react` folder:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**How to get these values:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy **Project URL** → paste as `VITE_SUPABASE_URL`
3. Copy **anon/public key** → paste as `VITE_SUPABASE_ANON_KEY`

---

## ▶️ Step 4: Run the Application

```bash
# Make sure you're in capstone-react folder
cd capstone-react

# Run both frontend and API server
npm run dev:all
```

This will start:
- **Frontend:** http://localhost:5173
- **API Server:** http://localhost:3000

---

## 🎨 Step 5: Add Test Data (Optional)

### Give Yourself Trust Points

Run in Supabase SQL Editor:
```sql
-- Replace 'YOUR_USER_ID' with your actual user ID
UPDATE account_status 
SET trust_points = 100 
WHERE id = 'YOUR_USER_ID';
```

### Add Some Shop Items (if not already seeded)

The shop items should already be created by the migration, but if you need to add more:
```sql
INSERT INTO shop_items (name, description, type, price, preview_url) VALUES
  ('Cool Badge', 'A cool badge', 'badge', 3, '🔥');
```

---

## ✅ Verify Everything Works

### Test Feature #1 (Profile Customization)
1. Click your profile avatar
2. Click **Profile Shop** button
3. You should see:
   - **SHOP tab:** Themes, Badges, Name Colors, Backgrounds, Avatar Borders
   - **INVENTORY tab:** Items you purchased
   - **CUSTOMIZE tab:** Apply purchased items
4. Buy something (costs Trust Points)
5. Apply it in CUSTOMIZE tab
6. View your profile - customizations should show

### Test Feature #2 (Task Boards)
1. Join or create a circle
2. Click **+ Add Channel**
3. Select **Type: Tasks** (not Chat)
4. Name it "Project Tasks"
5. Click on the new channel
6. You should see a **Kanban board** with 3 columns:
   - 📝 To Do
   - 🔄 In Progress
   - ✅ Done
7. Add a task, drag it between columns

---

## 🐛 Troubleshooting

### "Failed to fetch" errors
- Make sure both servers are running (`npm run dev:all`)
- Check that port 3000 and 5173 are not blocked

### "Permission denied" in database
- Check your user is in the `memberships` table for the circle
- Make sure RLS policies were created (run fix migrations)

### Shop items not showing
- Verify `shop_items` table has data
- Check browser console for errors

### Tasks not working
- Verify `task_items` table exists
- Check that channel `channel_type = 'tasks'`
- Ensure you're a member of the circle (rank_level >= 0)

---

## 📊 Database Schema Summary

### New Tables Added
1. **shop_items** - Available customization items
2. **user_purchases** - What users bought
3. **user_profile_settings** - User's active customizations
4. **task_items** - Tasks in kanban boards

### New Columns Added
1. **messages.media_url** - URL for uploaded media
2. **messages.media_type** - Type of media (image/voice)
3. **messages.voice_duration** - Duration of voice notes
4. **channels.channel_type** - Type of channel (chat/tasks/gallery/files/notes)
5. **user_profile_settings.active_avatar_border** - Selected border

---

## 🎯 What's New?

### Feature #1: Profile Customization Shop
- Buy themes, badges, name colors, backgrounds, avatar borders
- Spend Trust Points (TP) to customize your profile
- Minimum 10 TP balance requirement
- See customizations in chat and profiles

### Feature #2: Task Boards
- Create task-type channels
- Kanban board with drag-and-drop
- To Do → In Progress → Done workflow
- Real-time task updates

### Other Improvements
- Media messaging (upload images, send voice notes)
- Circle auto-membership when approved by admin
- Delete circle with proper cascade
- Better error logging

---

## 🆘 Need Help?

If you encounter issues:
1. Check the browser console (F12) for errors
2. Check the terminal where servers are running
3. Verify all migrations ran successfully
4. Make sure your `.env` file has correct Supabase credentials
5. Ask in the team chat!

---

## 🚀 You're All Set!

You should now have a fully functional local copy of Project NEXO with all the latest features. Happy coding! 🎉
