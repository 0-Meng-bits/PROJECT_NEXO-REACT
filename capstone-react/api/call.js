import { supabaseAdmin } from './_supabase.js';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_DOMAIN = process.env.DAILY_DOMAIN; // e.g. "yourname.daily.co"

async function getAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

  const { action, community_id, room_name } = req.body;

  // ── CREATE ROOM ─────────────────────────────────────────────────────────────
  if (action === 'create') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    const name = `nexo-${community_id}-${Date.now()}`;

    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // expires in 1 hour
          enable_chat: false, // we have our own chat
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          max_participants: 20,
        },
      }),
    });

    const room = await response.json();
    if (!response.ok) return res.status(400).json({ message: room.error || 'Failed to create room.' });

    return res.json({ room_url: room.url, room_name: room.name });
  }

  // ── DELETE ROOM ──────────────────────────────────────────────────────────────
  if (action === 'delete') {
    if (!room_name) return res.status(400).json({ message: 'Missing room_name.' });

    await fetch(`https://api.daily.co/v1/rooms/${room_name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    return res.json({ ok: true });
  }

  return res.status(400).json({ message: 'Invalid action.' });
}
