import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = req.query.userId || req.headers['x-user-id'] || req.body?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const { program, year_level, interests, last_seen, bio, cover_url, discoverable, full_name } = req.body;
  const updates = {};
  if (program !== undefined) updates.program = program;
  if (year_level !== undefined) updates.year_level = year_level;
  if (last_seen !== undefined) updates.last_seen = last_seen;
  if (bio !== undefined) updates.bio = bio;
  if (cover_url !== undefined) updates.cover_url = cover_url;
  if (discoverable !== undefined) updates.discoverable = discoverable;

  // Update full_name in accounts table separately
  if (full_name !== undefined && full_name.trim()) {
    const { error: accErr } = await supabaseAdmin.from('accounts').update({ full_name: full_name.trim() }).eq('id', userId);
    if (accErr) {
      console.error('[UPDATE PROFILE] accounts error:', accErr);
      return res.status(500).json({ message: 'Failed to update name.', error: accErr.message });
    }
  }

  // Update interests in user_interests junction table
  if (interests !== undefined) {
    const { error: delErr } = await supabaseAdmin.from('user_interests').delete().eq('user_id', userId);
    if (delErr) {
      console.error('[UPDATE PROFILE] delete interests error:', delErr);
      return res.status(500).json({ message: 'Failed to update interests.', error: delErr.message });
    }
    if (Array.isArray(interests) && interests.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('user_interests').insert(
        interests.map(interest => ({ user_id: userId, interest }))
      );
      if (insErr) {
        console.error('[UPDATE PROFILE] insert interests error:', insErr);
        return res.status(500).json({ message: 'Failed to save interests.', error: insErr.message });
      }
    }
  }

  if (!Object.keys(updates).length) return res.json({ message: 'Profile updated.' });

  let { error } = await supabaseAdmin
    .from('account_details')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' });

  // Graceful fallback if discoverable column is not yet migrated
  if (error && updates.discoverable !== undefined && error.message?.includes('discoverable')) {
    const { discoverable: _ignored, ...restUpdates } = updates;
    if (Object.keys(restUpdates).length > 0) {
      const retry = await supabaseAdmin
        .from('account_details')
        .upsert({ id: userId, ...restUpdates }, { onConflict: 'id' });
      error = retry.error;
    } else {
      error = null;
    }
  }

  if (error) {
    console.error('[UPDATE PROFILE]', error);
    return res.status(500).json({ message: 'Failed to update profile.', error: error.message });
  }

  res.json({ message: 'Profile updated.' });
}
