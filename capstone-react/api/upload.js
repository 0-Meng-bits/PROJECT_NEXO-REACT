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

      const { error } = await supabaseAdmin
        .from('account_details')
        .update({ avatar_url: avatar })
        .eq('id', userId);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ url: avatar });
    }

    // ── UPLOAD COVER (USER PROFILE) ────────────────────────────────────
    if (action === 'upload-cover-user') {
      const { userId, cover_url } = req.body;
      if (!userId || !cover_url) {
        return res.status(400).json({ error: 'Missing userId or cover_url' });
      }

      const { error } = await supabaseAdmin
        .from('account_details')
        .update({ cover_url })
        .eq('id', userId);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // ── UPLOAD COVER (COMMUNITY) ────────────────────────────────────────
    if (action === 'upload-cover') {
      const { communityId, logo_url, name, description, category } = req.body;

      if (!communityId) {
        return res.status(400).json({ error: 'Missing communityId' });
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (logo_url !== undefined) updates.logo_url = logo_url;

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
