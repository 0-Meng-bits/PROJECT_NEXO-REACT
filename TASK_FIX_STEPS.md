# TASK CREATION 403 FIX - STEP BY STEP

## Problem
When clicking "Create Task", you get a 403 Forbidden error because the RLS policy is broken.

## THE FIX (DO THIS NOW)

### Step 1: Go to Supabase SQL Editor
1. Open https://supabase.com/dashboard
2. Click your project
3. Click "SQL Editor" in the left sidebar
4. Click "New query"

### Step 2: Run This SQL
Copy and paste this ENTIRE block:

```sql
-- Drop the broken policies
DROP POLICY IF EXISTS "Circle members can create tasks" ON task_items;
DROP POLICY IF EXISTS "Circle members can update tasks" ON task_items;

-- Create fixed INSERT policy
CREATE POLICY "Circle members can create tasks"
  ON task_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Create fixed UPDATE policy
CREATE POLICY "Circle members can update tasks"
  ON task_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  );
```

### Step 3: Click RUN
- You'll see a warning about "destructive operations"
- **This is SAFE** - we're only updating policies, not deleting data
- Click "RUN" or "Confirm"

### Step 4: Wait for Success Message
- You should see "Success. No rows returned"
- This is correct!

### Step 5: Test
1. Go back to your app
2. Refresh the page (F5)
3. Click "Create Task"
4. It should work now!

## If It Still Doesn't Work

If you STILL get 403 after running the SQL:
1. Open browser console (F12)
2. Go to Network tab
3. Try creating a task
4. Click on the failed request
5. Take a screenshot and share it

## Profile Update Errors

The `[UPDATE PROFILE] TypeError: fetch failed` errors are separate.
This is likely because:
- The API server is having connection issues
- Or the .env file is missing variables

Make sure `npm run dev:all` is running both servers without errors.
