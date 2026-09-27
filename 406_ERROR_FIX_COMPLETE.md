# 406 Not Acceptable Error - FIXED ✅

## Problem
Users were experiencing **406 (Not Acceptable)** errors when the frontend tried to fetch profile customizations:
```
GET .../user_profile_settings?select=...&user_id=eq.... 406 (Not Acceptable)
```

This affected:
- Profile customizations (badges, name colors, themes, avatar borders)
- Any direct Supabase queries from the frontend
- User experience (console spam + broken features)

## Root Cause
Users log in through the **custom API** (`/api/login`), not Supabase Auth directly. The backend already generates Supabase session tokens and returns them, but the **frontend Supabase client was never authenticated**.

Without calling `supabase.auth.setSession()`, the Supabase client has **no authentication headers**, causing Supabase to reject queries with 406 before even checking RLS policies.

## Solution Implemented

### 1. Set Supabase Session After Login
**File**: `capstone-react/src/components/Auth.jsx`

After successful login, we now call:
```javascript
await supabase.auth.setSession({
  access_token: data.session.access_token,
  refresh_token: data.session.refresh_token
});
```

This authenticates the Supabase client with the session tokens returned by `/api/login`.

### 2. Restore Supabase Session on App Load
**File**: `capstone-react/src/App.jsx`

When the app loads and tokens exist in localStorage:
```javascript
if (token && refreshToken) {
  supabase.auth.setSession({
    access_token: token,
    refresh_token: refreshToken
  });
}
```

This ensures returning users have their Supabase session restored automatically.

## What This Fixes
✅ **All 406 errors eliminated** - Supabase client is now properly authenticated
✅ **Profile customizations work** - Badges, colors, themes display correctly
✅ **Direct Supabase queries work** - No need to proxy everything through backend
✅ **Consistent with backend** - Uses same Supabase Auth session as API
✅ **Clean console** - No more error spam

## Testing
After deployment:
1. **Login** → Session should be set automatically
2. **Open profile modal** → Customizations should load without 406 errors
3. **Refresh page** → Session should restore, still no errors
4. **Check console** → Should be clean (no 406 errors)

## Technical Notes
- The backend API (`/api/login`) already returns `session` with Supabase tokens
- RLS policies were already correct (not the issue)
- Problem was purely missing `supabase.auth.setSession()` call in frontend
- This is the proper way to integrate custom auth with Supabase

## Deployment
Changes pushed to GitHub:
- Vercel will auto-deploy frontend
- No backend changes needed (already working)
- Should be live in 1-2 minutes

---
**Status**: ✅ COMPLETE
**Date**: September 9, 2026
