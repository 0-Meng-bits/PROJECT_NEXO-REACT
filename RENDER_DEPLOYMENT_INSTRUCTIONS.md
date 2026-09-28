# Render Backend Deployment Instructions

## Problem
The `/api/close-poll` endpoint was added to `capstone-system/server.js` but hasn't been deployed to Render yet.

## What Was Added
In commit `1d1722d`, we added:
- New endpoint: `app.post('/api/close-poll', requireAuth, async (req, res) => {...})`
- CORS support: `app.use(cors())`
- New dependency: `"cors": "^2.8.5"` in `capstone-system/package.json`

## Steps to Deploy on Render

### Option 1: Check Auto-Deploy
1. Go to https://dashboard.render.com
2. Find your backend service (project-nexo-react)
3. Check the "Events" or "Deploys" tab
4. Look for recent deployments - should show commits from today

### Option 2: Manual Deploy
1. Go to https://dashboard.render.com
2. Find your backend service
3. Click "Manual Deploy" button (top right)
4. Select "Deploy latest commit"
5. Wait 1-2 minutes for deployment to complete

### Option 3: Check for Deployment Errors
1. In Render dashboard, check the "Logs" tab
2. Look for any errors during deployment
3. Common issues:
   - Missing environment variables
   - npm install failures
   - Build errors

## Verify Deployment
Once deployed, test the endpoint:
```bash
curl -X POST https://project-nexo-react.onrender.com/api/close-poll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"announcementId": "test", "communityId": "test"}'
```

Should return 403 or 401 (authorization error), not 404.

## Alternative: Check Service Settings
- **Build Command**: Should be `npm install` or `cd capstone-system && npm install`
- **Start Command**: Should be `node capstone-system/server.js` or `node server.js`
- **Root Directory**: Check if it's set correctly
- **Auto-Deploy**: Should be enabled for the `main` branch

## Files Changed (for reference)
- `capstone-system/server.js` - Added close-poll endpoint (lines 664-852)
- `capstone-system/package.json` - Added cors dependency

## Current Status
- ✅ Code pushed to GitHub (main branch)
- ❌ Not deployed to Render yet (getting 404 errors)
- ✅ Frontend configured to call Render backend
- ✅ Supabase migration ready to run

## What You Need To Do NOW
1. Open Render dashboard
2. Trigger manual deploy
3. Wait for it to complete
4. Test the "Close Poll" button again
