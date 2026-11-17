import { supabaseAdmin } from './_supabase.js';

const DAILY_API_KEY = process.env.DAILY_API_KEY;

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

  // ── CREATE ROOM ──────────────────────────────────────────────────────────────
  if (action === 'create') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    // Check if there's already an active call for this circle
    const { data: existing } = await supabaseAdmin
      .from('circle_calls')
      .select('room_url, room_name')
      .eq('community_id', community_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      // Return the existing room so the user joins it
      return res.json({ room_url: existing.room_url, room_name: existing.room_name, existing: true });
    }

    const name = `nexo-${community_id.slice(0, 8)}-${Date.now()}`;

    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          max_participants: 20,
        },
      }),
    });

    const room = await response.json();
    if (!response.ok) return res.status(400).json({ message: room.error || 'Failed to create room.' });

    // Save to circle_calls
    await supabaseAdmin.from('circle_calls').insert([{
      community_id,
      room_name: room.name,
      room_url: room.url,
      started_by: userId,
      status: 'active',
    }]);

    return res.json({ room_url: room.url, room_name: room.name, existing: false });
  }

  // ── END CALL ──────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    if (!room_name) return res.status(400).json({ message: 'Missing room_name.' });

    // Delete from Daily
    await fetch(`https://api.daily.co/v1/rooms/${room_name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    // Mark as ended in DB
    await supabaseAdmin.from('circle_calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('room_name', room_name);

    return res.json({ ok: true });
  }

  // ── GET ACTIVE CALL ───────────────────────────────────────────────────────────
  if (action === 'get_active') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });

    const { data } = await supabaseAdmin
      .from('circle_calls')
      .select('room_url, room_name, started_at, started_by')
      .eq('community_id', community_id)
      .eq('status', 'active')
      .maybeSingle();

    return res.json({ call: data || null });
  }

  return res.status(400).json({ message: 'Invalid action.' });
}
