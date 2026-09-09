# Media Messaging Feature Guide

## Overview
Added support for images, videos, and voice messages in chat.

## What Was Added

### Database Changes
- ✅ Added `message_type`, `media_url`, `media_size`, `media_duration` columns to `messages` table
- ✅ Created `chat-media` storage bucket (50 MB limit per file)
- ✅ Set up storage policies for authenticated uploads and public viewing

### Frontend Features

**1. Image Sharing**
- Click paperclip icon to attach images
- Supported formats: JPEG, PNG, WebP, GIF
- Max size: 10 MB
- Images display inline with click-to-enlarge

**2. Video Sharing**
- Upload videos via paperclip icon
- Supported formats: MP4, WebM, QuickTime
- Max size: 50 MB
- Videos play inline with controls
- For larger videos, users see message suggesting YouTube/Drive

**3. Voice Messages**
- Click microphone icon to start recording
- Click stop icon to finish
- Max size: 10 MB
- Browser requests microphone permission
- Playback with audio controls

## File Size Limits

| Type | Max Size | Why |
|------|----------|-----|
| Images | 10 MB | Balance quality & storage |
| Videos | 50 MB | ~1 min HD video |
| Voice | 10 MB | ~10 min of audio |

**Supabase free tier: 1 GB total storage**

## User Experience

### Sending Media
1. Click paperclip (files) or microphone (voice)
2. Select/record your media
3. Preview appears above input
4. Add optional text caption
5. Click SEND (button shows "SENDING..." during upload)
6. Cancel anytime by clicking X on preview

### Viewing Media
- **Images**: Click to open full size in new tab
- **Videos**: Play inline with standard controls
- **Voice**: Audio player with duration display

## Components Added

### `MediaMessageHelpers.jsx`
- `MediaUploadButton` - File picker for images/videos
- `VoiceRecorder` - Audio recording interface
- `MediaPreview` - Shows selected media before sending
- `MediaMessage` - Renders media in chat bubbles
- `uploadMediaFile()` - Handles Supabase storage upload

### Updated in `UserPortal.jsx`
- Added media state management
- Updated `sendPost()` and `sendCircleChatPost()` for uploads
- Integrated media buttons into composers
- Updated `MessageItem` to display media

## Technical Details

### File Validation
- Type checking before upload
- Size limits enforced client-side
- Clear error messages for violations

### Storage Structure
```
chat-media/
├── {userId}/
│   ├── {timestamp}-image.jpg
│   ├── {timestamp}-video.mp4
│   └── {timestamp}-voice.webm
```

### Browser Compatibility
- File uploads: All modern browsers
- Voice recording: Requires `MediaRecorder` API (Chrome, Firefox, Edge, Safari 14.1+)
- Falls back gracefully if microphone unavailable

## Future Enhancements (Not Implemented)

### Voice/Video Calls
Would require:
- WebRTC integration (Agora, Daily.co, Twilio)
- Free tier: ~10,000 minutes/month
- Signaling server for peer connection
- UI for incoming/active calls

**Recommendation**: Skip for now unless you get budget. Suggest users use Discord/Meet/Zoom instead.

## Troubleshooting

**"Could not access microphone"**
- User denied permission
- Check browser settings → Site permissions
- HTTPS required for microphone access

**Upload fails**
- Check Supabase storage bucket exists
- Verify storage policies are correct
- Check file size limits
- Ensure user is authenticated

**Media doesn't display**
- Verify `media_url` is public
- Check storage bucket is public
- Confirm file wasn't deleted from storage

## Testing Checklist

- [ ] Send image message
- [ ] Send video message
- [ ] Record and send voice message
- [ ] Try file over size limit (should show error)
- [ ] Send media with text caption
- [ ] Send media without caption
- [ ] View sent media in chat
- [ ] Real-time updates work with media messages
- [ ] Mobile responsiveness
- [ ] Storage policies allow authenticated uploads
- [ ] Public can view shared media

## Storage Monitoring

Monitor usage in Supabase Dashboard:
1. Go to Storage → chat-media bucket
2. Check "Usage" tab
3. Set up alerts when approaching 1 GB limit

**When approaching limit:**
- Implement cleanup for old media
- Upgrade Supabase plan
- Enforce stricter size limits
- Implement media expiration
