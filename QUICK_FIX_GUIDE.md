# Quick Fix Guide

## Issue: "Tracking Prevention" Warnings After Giving Trust Points

### What You're Seeing

Console shows multiple "Tracking Prevention blocked access to storage" warnings after clicking "GIVE POINTS" button.

---

## ✅ Good News

**These warnings are HARMLESS!**

- They're just browser notices, not actual errors
- localStorage still works perfectly
- All features function normally
- You can safely ignore them

---

## Why This Happens

1. Your browser (Safari/Firefox/Brave) monitors localStorage access
2. The app uses `localStorage.getItem('accessToken')` to authenticate API calls
3. Browser logs this as "potential tracking" but allows it anyway
4. This is normal behavior for privacy-focused browsers

---

## Real Issue: "Network Error" When Giving Points

If you see **"Network error. Please try again."** message:

### Fix: Run Missing Migration

1. Open **Supabase SQL Editor**
2. Find file: `supabase/migrations/20260826000000_trust_points_system.sql`
3. Copy all contents
4. Paste and run in SQL Editor

Or run this checker first:
```bash
check_trust_points_tables.sql
```

This will tell you if tables are missing.

---

## What Gets Created

The migration creates:
- `point_transactions` - tracks all trust point changes
- `appreciation_cooldowns` - prevents spam (12hr cooldown)
- `can_give_appreciation()` - function to check cooldowns
- RLS policies for security

---

## Quick Steps

```bash
# 1. Check if tables exist
Run: check_trust_points_tables.sql in Supabase SQL Editor

# 2. If missing, run migration
Run: supabase/migrations/20260826000000_trust_points_system.sql

# 3. Test giving trust points
Should work without "Network error"
```

---

## Tracking Prevention Warnings

Just **ignore them** - they don't affect functionality. Modern browsers log localStorage access as part of privacy monitoring, but still allow it.

If you want to hide them (optional):
- **Safari**: Settings → Privacy → Disable "Prevent cross-site tracking"
- **Firefox**: Settings → Privacy → Set to "Standard" (not Strict)
- **Brave**: Settings → Shields → "Standard" mode
