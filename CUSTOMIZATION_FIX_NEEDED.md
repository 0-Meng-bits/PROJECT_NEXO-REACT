# Customization Display - Fix Needed

## Problem
CORS errors when CustomizedUsername component tries to query Supabase for each message individually.

## Solution Approach
Load ALL customizations in batch when messages load, then pass them down as props.

## Implementation Steps

### 1. Add State for Customizations
```javascript
// In UserPortal.jsx, add near other state
const [userCustomizations, setUserCustomizations] = useState({}); // studentId -> customizations
```

### 2. Create Batch Loading Function
```javascript
const loadCustomizationsForMessages = useCallback(async (msgs) => {
  if (!msgs || msgs.length === 0) return;
  
  const studentIds = [...new Set(msgs.map(m => m.student_id).filter(Boolean))];
  if (studentIds.length === 0) return;

  try {
    // Get account IDs from student IDs
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, ctu_id')
      .in('ctu_id', studentIds);

    if (!accounts || accounts.length === 0) return;

    const accountIds = accounts.map(a => a.id);
    
    // Load all customizations at once
    const { data: settings } = await supabase
      .from('user_profile_settings')
      .select(`
        user_id,
        theme:active_theme(preview_url, css_data),
        badge:active_badge(preview_url, css_data),
        name_color:active_name_color(preview_url, css_data),
        background:active_background(preview_url, css_data)
      `)
      .in('user_id', accountIds);

    if (!settings) return;

    // Map back to student IDs
    const customsMap = {};
    accounts.forEach(acc => {
      const setting = settings.find(s => s.user_id === acc.id);
      if (setting) {
        customsMap[acc.ctu_id] = setting;
      }
    });

    setUserCustomizations(prev => ({ ...prev, ...customsMap }));
  } catch (err) {
    console.error('Failed to load customizations:', err);
  }
}, []);
```

### 3. Call After Loading Messages
```javascript
// In loadMessages function, after setting messages:
loadCustomizationsForMessages(data || []);
```

### 4. Pass to CustomizedUsername
```javascript
// In MessageItem rendering:
<CustomizedUsername 
  studentId={m.student_id} 
  username={m.full_name}
  customizations={userCustomizations[m.student_id]}
/>
```

### 5. Update CustomizedUsername Component
Already done - it accepts `customizations` prop and uses it if provided.

## Benefits
- ✅ Single database query for all users
- ✅ No CORS issues
- ✅ Better performance
- ✅ Cleaner code

## Status
- State added ✅
- Function created (needs to be inserted) ⏳
- Component updated ✅

**Just need to insert the batch loading function and call it!**
