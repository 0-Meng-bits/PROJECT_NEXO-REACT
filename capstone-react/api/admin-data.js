import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  // POST — write actions (add/delete events)
  if (req.method === 'POST') {
    const { action, id, ...payload } = req.body;
    try {
      if (action === 'add_event') {
        const { title, description, category, event_date, event_end_date, event_time, location, poster_name, poster_type } = payload;
        const eventData = {
          title,
          description: description || null,
          category: category || 'general',
          event_date,
          event_end_date: event_end_date || event_date || null,
          event_time: event_time || null,
          location: location || null,
          poster_name: poster_name || 'Admin',
          poster_type: poster_type || 'Admin',
          community_id: null,
          is_official: true,
        };
        const { data, error } = await supabaseAdmin.from('campus_events').insert([eventData]).select().single();
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ event: data });
      }
      if (action === 'delete_event') {
        const { error } = await supabaseAdmin.from('campus_events').delete().eq('id', id);
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ ok: true });
      }
      if (action === 'update_ticket') {
        const { status, user_id } = payload;
        const { error } = await supabaseAdmin.from('support_tickets').update({ status }).eq('id', id);
        if (error) return res.status(400).json({ message: error.message });
        // Notify the user
        if (user_id) {
          const msg = status === 'resolved'
            ? 'Your support ticket has been resolved. Thank you for reaching out!'
            : 'Your support ticket has been closed.';
          await supabaseAdmin.from('notifications').insert([{
            user_id,
            type: 'ticket_update',
            message: msg,
            category: 'Campus',
          }]);
        }
        return res.json({ ok: true });
      }
      return res.status(400).json({ message: 'Unknown action.' });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [studRes, annRes, audRes, msgRes, membRes, repRes, allMsgRes, circAnnRes, eventsRes, ticketsRes] = await Promise.all([
      supabaseAdmin.from('accounts').select('*, account_status(*), account_details(*)').order('created_at', { ascending: false }),
      supabaseAdmin.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
      supabaseAdmin.from('application_submissions').select('*, accounts!applicant_id(full_name, ctu_id), communities(name)').order('submitted_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('memberships').select('community_id, status, created_at'),
      supabaseAdmin.from('reports').select('*, reporter:reporter_id(full_name, ctu_id), reported:reported_user_id(full_name, ctu_id)').order('created_at', { ascending: false }),
      supabaseAdmin.from('messages').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('announcements').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('campus_events').select('*').order('event_date', { ascending: true }),
      supabaseAdmin.from('support_tickets').select('*, accounts:user_id(full_name, ctu_id)').order('created_at', { ascending: false }),
    ]);
    res.json({
      students: studRes.data || [],
      announcements: annRes.data || [],
      applications: audRes.data || [],
      messages: msgRes.data || [],
      memberships: membRes.data || [],
      reports: repRes.data || [],
      allMessages: allMsgRes.data || [],
      circleAnnouncements: circAnnRes.data || [],
      campusEvents: eventsRes.data || [],
      tickets: ticketsRes.data || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
