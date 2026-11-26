import { supabaseAdmin } from './_supabase.js';
import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

async function getAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

async function getAuthUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: account } = await supabaseAdmin.from('accounts').select('full_name').eq('id', user.id).single();
  return { id: user.id, full_name: account?.full_name || 'User' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized.' });

  const { action, community_id, room_name } = req.body;

  // ── JOIN / CREATE ROOM ───────────────────────────────────────────────────────
  if (action === 'create') {
    if (!community_id) return res.status(400).json({ message: 'Missing community_id.' });
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({ message: 'LiveKit credentials are not configured on the server.' });
    }

    const roomName = `nexo-${community_id.slice(0, 8)}`;

    // Check for existing active call
    const { data: existing } = await supabaseAdmin
      .from('circle_calls')
      .select('room_name')
      .eq('community_id', community_id)
      .eq('status', 'active')
      .maybeSingle();

    const finalRoomName = existing ? existing.room_name : roomName;

    // Generate LiveKit access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user.id,
      name: user.full_name,
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room: finalRoomName,
      canPublish: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });
    const token = await at.toJwt();

    // Save to DB if new call
    if (!existing) {
      await supabaseAdmin.from('circle_calls').insert([{
        community_id,
        room_name: finalRoomName,
        started_by: user.id,
        status: 'active',
      }]);
    }

    return res.json({
      token,
      room_name: finalRoomName,
      livekit_url: LIVEKIT_URL,
      existing: !!existing,
    });
  }

  // ── END CALL ──────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    if (!room_name) return res.status(400).json({ message: 'Missing room_name.' });

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
      .select('room_name, started_at')
      .eq('community_id', community_id)
      .eq('status', 'active')
      .maybeSingle();
    return res.json({ call: data || null });
  }

  return res.status(400).json({ message: 'Invalid action.' });
}
