import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    // ── GET SIGNED UPLOAD URL ────────────────────────────────────────────
    if (action === 'get-upload-url') {
      const { userId, fileName, contentType } = req.body;
      if (!userId || !fileName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const timestamp = Date.now();
      const storagePath = `${userId}/${timestamp}-${fileName}`;

      // Create a signed upload URL (valid for 60 seconds)
      const { data, error } = await supabaseAdmin.storage
        .from('chat-media')
        .createSignedUploadUrl(storagePath);

      if (error) {
        console.error('Signed URL error:', error);
        return res.status(500).json({ error: error.message });
      }

      // Return both the signed URL and the final path
      return res.json({ 
        uploadUrl: data.signedUrl,
        path: storagePath,
        token: data.token
      });
    }

    // ── UPLOAD AVATAR ───────────────────────────────────────────────────
    if (action === 'upload-avatar') {
      const { userId, avatar } = req.body;
      if (!userId || !avatar) {
        return res.status(400).json({ error: 'Missing userId or avatar data' });
      }

      // Upload to storage bucket instead of storing base64 in DB (saves disk IO)
      let publicUrl = avatar; // fallback: keep base64 if storage fails
      if (avatar.startsWith('data:')) {
        const matches = avatar.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const path = `avatars/${userId}/avatar.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from('avatars')
            .upload(path, buffer, { contentType: `image/${matches[1]}`, upsert: true });
          if (!upErr) {
            const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
            publicUrl = urlData.publicUrl;
          }
        }
      }

      const { error } = await supabaseAdmin
        .from('account_details')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ url: publicUrl });
    }

    // ── UPLOAD COVER (USER PROFILE) ────────────────────────────────────
    if (action === 'upload-cover-user') {
      const { userId, cover_url } = req.body;
      if (!userId || !cover_url) {
        return res.status(400).json({ error: 'Missing userId or cover_url' });
      }

      // Upload to storage if base64
      let finalUrl = cover_url;
      if (cover_url.startsWith('data:')) {
        const matches = cover_url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const path = `covers/${userId}/cover.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from('avatars')
            .upload(path, buffer, { contentType: `image/${matches[1]}`, upsert: true });
          if (!upErr) {
            const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
            finalUrl = urlData.publicUrl;
          }
        }
      }

      const { error } = await supabaseAdmin
        .from('account_details')
        .update({ cover_url: finalUrl })
        .eq('id', userId);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true, url: finalUrl });
    }

    // ── UPLOAD COVER (COMMUNITY) ────────────────────────────────────────
    if (action === 'upload-cover') {
      const { communityId, logo_url, cover_url, name, description, category, is_open, interest_tag } = req.body;

      if (!communityId) {
        return res.status(400).json({ error: 'Missing communityId' });
      }

      // Helper: if value is base64, upload to storage and return public URL
      const toStorageUrl = async (base64, pathKey) => {
        if (!base64 || !base64.startsWith('data:')) return base64;
        const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) return base64;
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const storagePath = `communities/${communityId}/${pathKey}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('avatars')
          .upload(storagePath, buffer, { contentType: `image/${matches[1]}`, upsert: true });
        if (upErr) return base64; // fallback to base64 on failure
        const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(storagePath);
        return urlData.publicUrl;
      };

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (is_open !== undefined) updates.is_open = is_open;
      if (interest_tag !== undefined) updates.interest_tag = interest_tag;
      if (logo_url !== undefined) updates.logo_url = await toStorageUrl(logo_url, 'logo');
      if (cover_url !== undefined) updates.cover_url = await toStorageUrl(cover_url, 'cover');

      const { error } = await supabaseAdmin
        .from('communities')
        .update(updates)
        .eq('id', communityId);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
