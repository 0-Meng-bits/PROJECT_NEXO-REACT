# Tracking Prevention Warnings & Give Trust Points Error

## Understanding the Warnings

The console shows: **"Tracking Prevention blocked access to storage"**

### Important: These Are Harmless Warnings!

✅ **These warnings do NOT break functionality**  
✅ **localStorage still works** - the browser just logs a notice  
✅ **You can safely ignore them**

The warnings appear because:
- Your browser privacy settings monitor localStorage access
- The app uses `localStorage.getItem('accessToken')` to authenticate
- Browser logs this as "potential tracking" but allows it anyway

---

## Fix "Network Error" When Giving Trust Points

If you see **"Network error. Please try again."** when giving trust points:

### 1. Check Migration Status

Run `check_trust_points_tables.sql` in **Supabase SQL Editor**:

```sql
-- This will show if trust points tables exist
```

### 2. If Tables Are Missing

Find and run: `supabase/migrations/20260826000000_trust_points_system.sql`

This migration creates:
- ✅ `point_transactions` table
- ✅ `appreciation_cooldowns` table  
- ✅ `can_give_appreciation()` function
- ✅ Trust points RLS policies

### 3. Verify API Is Running

Make sure your development server is running:
```bash
cd capstone-react
npm run dev
```

The `/api/moderation` endpoint must be accessible.

---

## Media Upload Issues (If You Have Them)

### Quick Test First

1. Click paperclip button in chat
2. Select image (under 10MB)
3. Send message

**If image appears** → Everything works!  
**If upload fails** → Run `fix_storage_policies.sql`

### Run SQL Fix

Copy `fix_storage_policies.sql` into **Supabase SQL Editor** and run it.

### Verify Bucket

In Supabase Dashboard:
1. Storage → **chat-media** bucket
2. Settings (gear icon)
3. Verify:
   - ✅ Public: ON
   - ✅ File size limit: 50 MB

---

## Summary

1. **Tracking Prevention warnings** = harmless, ignore them
2. **Network error on give points** = missing migration, run `20260826000000_trust_points_system.sql`
3. **Media upload fails** = run `fix_storage_policies.sql`

The tracking warnings are normal browser behavior and don't break anything!

**Safari:**
- Settings → Privacy → Disable "Prevent cross-site tracking"
- Or: Safari → Preferences → Privacy → Uncheck "Prevent cross-site tracking"

**Firefox:**
- Settings → Privacy & Security → Enhanced Tracking Protection → Set to "Standard" (not Strict)

**Chrome:**
- Settings → Privacy and security → Third-party cookies → Allow

**Brave:**
- Settings → Shields → Set to "Standard" or "Allow all cookies"

### 4. Test Upload
1. Refresh your app (Ctrl+Shift+R or Cmd+Shift+R)
2. Try uploading an image in chat
3. Check console - errors should be gone

---

## Still Not Working?

If errors persist:

1. **Check Supabase URL** in `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   ```
   Make sure it matches your actual project URL.

2. **Check network tab** (F12 → Network):
   - Look for failed storage requests
   - Check if CORS errors appear

3. **Verify authentication**:
   - User must be logged in to upload
   - Check that `auth.uid()` is present

---

## How Media Upload Works

1. User selects file → `MediaUploadButton` component
2. File validation (type + size)
3. Upload to `chat-media` bucket → `uploadMediaFile()` function
4. Get public URL
5. Save message with `media_url` + `message_type` to database
6. Display using `MediaMessage` component

---

## File Limits

- **Images**: 10 MB (JPEG, PNG, WebP, GIF)
- **Videos**: 50 MB (MP4, WebM, QuickTime)
- **Voice**: 10 MB (WebM, MP3, OGG, WAV)

Users exceeding limits are prompted to use external links (YouTube, Drive, etc.)
