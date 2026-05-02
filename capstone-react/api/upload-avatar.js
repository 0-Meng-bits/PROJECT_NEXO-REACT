import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Resolve user identity — prefer JWT token, fall back to x-user-id header
  let userId = null;

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) userId = user.id;
  }

  if (!userId) {
    userId = req.headers['x-user-id'] || null;
  }

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const { avatar } = req.body;
  if (!avatar || typeof avatar !== 'string') {
    return res.status(400).json({ message: 'Missing avatar data.' });
  }

  // Parse base64 data URL  →  Buffer
  const matches = avatar.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ message: 'Invalid image format.' });
  }

  const mimeType = matches[1]; // e.g. "image/jpeg"
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Derive extension from mime type
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const ext = extMap[mimeType] || 'jpg';
  const path = `avatars/${userId}.${ext}`;

  // Upload to Supabase Storage (service role bypasses RLS)
  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return res.status(500).json({ message: 'Upload failed.', detail: uploadError.message });
  }

  // Get the public URL
  const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Persist the URL in the profiles table
  const { error: dbError } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (dbError) {
    console.error('DB update error:', dbError);
    // Still return the URL — the client can save it locally
    return res.status(207).json({ url: publicUrl, warning: 'Saved to storage but DB update failed.' });
  }

  return res.status(200).json({ url: publicUrl });
}
