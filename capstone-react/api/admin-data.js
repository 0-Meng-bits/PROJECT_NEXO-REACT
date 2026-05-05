import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  // POST — write actions (add/delete events)
  if (req.method === 'POST') {
    const { action, id, ...payload } = req.body;
    try {
      if (action === 'add_event') {
        const { data, error } = await supabaseAdmin.from('campus_events').insert([payload]).select().single();
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ event: data });
      }
      if (action === 'delete_event') {
        const { error } = await supabaseAdmin.from('campus_events').delete().eq('id', id);
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ ok: true });
      }
      return res.status(400).json({ message: 'Unknown action.' });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [studRes, annRes, audRes, msgRes, membRes, repRes, allMsgRes, circAnnRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
      supabaseAdmin.from('audition_responses').select('*, profiles(full_name, student_id), communities(name)').order('submitted_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('memberships').select('community_id, status, created_at'),
      supabaseAdmin.from('reports').select('*, reporter:reporter_id(full_name, student_id), reported:reported_user_id(full_name, student_id)').order('created_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('announcements').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('campus_events').select('*').order('start_date', { ascending: true }),
    ]);
    res.json({
      students: studRes.data || [],
      announcements: annRes.data || [],
      auditions: audRes.data || [],
      messages: msgRes.data || [],
      memberships: membRes.data || [],
      reports: repRes.data || [],
      allMessages: allMsgRes.data || [],
      circleAnnouncements: circAnnRes.data || [],
      campusEvents: eventsRes.data || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
