import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = req.query.userId || req.headers['x-user-id'] || req.body?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const { course, year_level, interests, last_seen } = req.body;
  const updates = {};
  if (course !== undefined) updates.course = course;
  if (year_level !== undefined) updates.year_level = year_level;
  if (interests !== undefined) updates.interests = interests;
  if (last_seen !== undefined) updates.last_seen = last_seen;

  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nothing to update.' });

  const { error } = await supabaseAdmin
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('[UPDATE PROFILE]', error.message);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }

  res.json({ message: 'Profile updated.' });
}
