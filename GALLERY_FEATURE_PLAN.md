# 🎮 Gallery Feature Implementation Plan

## Overview
Add a photo/video gallery view for **Hobby** category communities, displaying media in a grid layout.

---

## ✅ What Already Exists

1. **Database**
   - ✅ `channel_type` enum includes `'gallery'`
   - ✅ Media upload system working (chat-media bucket)
   - ✅ Messages table stores media URLs

2. **Backend**
   - ✅ Media upload via signed URLs working
   - ✅ Messages API handles media_url and media_type

3. **Frontend**
   - ✅ Task Board pattern to follow (line 5000-5010 in UserPortal.jsx)
   - ✅ Media preview component exists (MediaMessage)

---

## 🔨 What We Need to Build

### **Step 1: Create Gallery Component** (30 min)
**File**: `capstone-react/src/components/Gallery.jsx`

**Features**:
- Grid layout (3-4 columns)
- Display images/videos from messages where `media_url` exists
- Click to view full size (lightbox)
- Show uploader name and date
- Filter by media type (photos/videos/all)

**Props**:
```javascript
<Gallery 
  channelId={channelId}
  canUpload={boolean}
  currentUserId={userId}
/>
```

---

### **Step 2: Integrate Gallery into UserPortal** (15 min)
**File**: `capstone-react/src/components/UserPortal.jsx`

**Location**: Around line 5000 (where Task Board is)

**Logic**:
```javascript
const currentChannel = channels.find(c => c.id === activeChannelId);
const channelType = currentChannel?.channel_type || 'chat';

if (activeChannelId && channelType === 'gallery') {
  return <Gallery channelId={activeChannelId} canUpload={true} currentUserId={user.id} />;
}

if (activeChannelId && channelType === 'tasks') {
  return <TaskBoard ... />;
}

// Otherwise show chat messages
```

---

### **Step 3: Auto-Create Gallery Channel for Hobby Communities** (15 min)
**File**: `capstone-react/src/components/UserPortal.jsx`

**Location**: In `CreateModal` component (around line 787)

**Logic**: When category is `'hobby'`, auto-create a gallery channel after community creation:
```javascript
if (form.category === 'hobby') {
  await supabase.from('channels').insert([{
    community_id: newCommunityId,
    name: 'gallery',
    channel_type: 'gallery',
    created_by: userId
  }]);
}
```

---

## 📊 Database Changes

**None needed!** Everything is already in place:
- ✅ `channels.channel_type` supports `'gallery'`
- ✅ `messages.media_url` and `messages.media_type` exist
- ✅ Storage bucket `chat-media` configured

---

## 🎨 UI Design

### Gallery Grid Layout:
```
┌─────────────────────────────────────────┐
│  GALLERY                    [+ Upload]  │
├─────────────────────────────────────────┤
│ Filter: [All] [Photos] [Videos]         │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │     │ │     │ │     │ │     │        │
│ │ IMG │ │ VID │ │ IMG │ │ IMG │        │
│ │     │ │     │ │     │ │     │        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
│ User1   User2   User3   User4          │
│ 2h ago  5h ago  1d ago  3d ago         │
│                                         │
│ ┌─────┐ ┌─────┐ ┌─────┐                │
│ │     │ │     │ │     │                │
│ └─────┘ └─────┘ └─────┘                │
└─────────────────────────────────────────┘
```

### Colors:
- Container background: `rgba(0,0,0,0.6)` + blur
- Grid items: `rgba(255,255,255,0.05)` hover effect
- Border: `rgba(0,240,255,0.2)`
- Cyber theme maintained

---

## ⏱️ Time Estimate

| Task | Time |
|------|------|
| Create Gallery.jsx component | 30 min |
| Integrate into UserPortal | 15 min |
| Auto-create for hobby communities | 15 min |
| Testing | 15 min |
| **TOTAL** | **75 min (~1.25 hours)** |

---

## 🧪 Testing Checklist

- [ ] Create a new Hobby community
- [ ] Verify gallery channel auto-created
- [ ] Upload photos/videos to gallery
- [ ] Grid displays correctly
- [ ] Click image opens lightbox
- [ ] Filter works (All/Photos/Videos)
- [ ] Mobile responsive

---

## 🚀 Ready to Build?

Let's start with **Gallery.jsx** component!
