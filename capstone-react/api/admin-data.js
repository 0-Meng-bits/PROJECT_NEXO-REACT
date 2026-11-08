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
      if (action === 'issue_warning') {
        const { user_id, admin_id, reason } = payload;
        const { data: profile } = await supabaseAdmin.from('account_status')
          .select('warning_count, trust_points, is_banned, suspended_until')
          .eq('id', user_id).single();

        if (profile?.is_banned) return res.json({ alreadyBanned: true });

        const currentPoints = profile?.trust_points ?? 10;
        const newPoints = Math.max(0, currentPoints - 1);
        const newWarnings = (profile?.warning_count || 0) + 1;
        const isAlreadySuspended = profile?.suspended_until && new Date(profile.suspended_until) > new Date();

        // Auto-ban: already suspended and gets another warning
        if (isAlreadySuspended) {
          await supabaseAdmin.from('account_status').update({ is_banned: true, suspended_until: null }).eq('id', user_id);
          await supabaseAdmin.from('user_warnings').insert([{ user_id, admin_id, type: 'ban', reason: `Auto-banned after repeated violations. ${reason}` }]);
          await supabaseAdmin.from('notifications').insert([{ user_id, type: 'audition_update', message: `Your account has been permanently banned due to repeated violations. Reason: ${reason}` }]);
          return res.json({ autoBanned: true });
        }

        const willSuspend = newPoints === 0;
        const suspendedUntil = willSuspend ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

        await supabaseAdmin.from('user_warnings').insert([{ user_id, admin_id, type: 'warning', reason }]);
        await supabaseAdmin.from('point_transactions').insert([{ user_id, amount: -1, transaction_type: 'warning', from_user_id: admin_id, reason }]);
        await supabaseAdmin.from('account_status').update({
          warning_count: newWarnings,
          trust_points: newPoints,
          ...(willSuspend ? { suspended_until: suspendedUntil } : {}),
        }).eq('id', user_id);

        const notifMsg = willSuspend
          ? `🚫 Your account has been suspended for 7 days due to repeated violations. Reason: ${reason}. You can log in again after ${new Date(suspendedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
          : `⚠️ Warning from Admin (${newPoints} trust point${newPoints !== 1 ? 's' : ''} remaining): ${reason}. ${newPoints === 1 ? 'One more violation will result in a 7-day suspension.' : ''}`;
        await supabaseAdmin.from('notifications').insert([{ user_id, type: 'audition_update', message: notifMsg }]);

        return res.json({ newPoints, willSuspend, newWarnings });
      }
      if (action === 'issue_flag_warning') {
        const { flag_id, user_id, admin_id, severity, points_deducted, community_id, reason } = payload;
        const { data: warning } = await supabaseAdmin.from('user_warnings').insert([{
          user_id, admin_id, type: 'warning', severity, points_deducted, community_id, reason
        }]).select().single();
        await supabaseAdmin.from('point_transactions').insert([{
          user_id, amount: -points_deducted, transaction_type: 'warning', reason: `Warning: ${reason}`, reference_id: warning?.id
        }]);
        const { data: status } = await supabaseAdmin.from('account_status').select('trust_points').eq('id', user_id).single();
        const newTP = Math.max(0, (status?.trust_points ?? 10) - points_deducted);
        await supabaseAdmin.from('account_status').update({ trust_points: newTP }).eq('id', user_id);
        await supabaseAdmin.from('user_flags').update({ status: 'warning_issued', reviewed_by: admin_id, reviewed_at: new Date().toISOString() }).eq('id', flag_id);
        return res.json({ ok: true });
      }
      if (action === 'ban_user') {
        const { user_id, admin_id, reason } = payload;
        await supabaseAdmin.from('account_status').update({ is_banned: true }).eq('id', user_id);
        await supabaseAdmin.from('user_warnings').insert([{ user_id, admin_id, type: 'ban', reason }]);
        await supabaseAdmin.from('notifications').insert([{ user_id, type: 'audition_update', message: `🚫 Your account has been banned: ${reason}` }]);
        return res.json({ ok: true });
      }
      if (action === 'unban_user') {
        const { user_id } = payload;
        await supabaseAdmin.from('account_status').update({ is_banned: false }).eq('id', user_id);
        await supabaseAdmin.from('notifications').insert([{ user_id, type: 'audition_update', message: '✅ Your ban has been lifted. You can now log back in to NEXO Connect.' }]);
        return res.json({ ok: true });
      }
      if (action === 'unsuspend_user') {
        const { user_id } = payload;
        await supabaseAdmin.from('account_status').update({ suspended_until: null }).eq('id', user_id);
        await supabaseAdmin.from('notifications').insert([{ user_id, type: 'audition_update', message: '✅ Your suspension has been lifted early. You can now log back in to NEXO Connect.' }]);
        return res.json({ ok: true });
      }
      if (action === 'submit_ban_appeal') {
        const { ctu_id, message, ticket_type } = payload;
        const { data: account } = await supabaseAdmin.from('accounts').select('id, full_name').eq('ctu_id', ctu_id).maybeSingle();
        if (!account) return res.status(404).json({ message: 'CTU ID not found.' });

        // 1-per-day limit — check appeals submitted today (PH time UTC+8)
        const now = new Date();
        const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const todayPH = phTime.toISOString().slice(0, 10); // 'YYYY-MM-DD'
        const todayStart = new Date(todayPH + 'T00:00:00+08:00').toISOString();
        const { count } = await supabaseAdmin
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', account.id)
          .in('category', ['Ban Appeal', 'Suspension Appeal'])
          .gte('created_at', todayStart);
        if (count > 0) {
          return res.status(429).json({ message: 'You already submitted an appeal today. Please wait 24 hours before submitting again.' });
        }

        await supabaseAdmin.from('support_tickets').insert([{
          user_id: account.id,
          category: ticket_type === 'ban' ? 'Ban Appeal' : 'Suspension Appeal',
          message: `[${ticket_type === 'ban' ? 'BAN APPEAL' : 'SUSPENSION APPEAL'}] ${message}`,
          status: 'open',
        }]);
        return res.json({ ok: true });
      }
      if (action === 'resolve_appeal') {
        const { warning_id, user_id, decision, admin_note, admin_id } = payload;
        // Update the appeal status
        await supabaseAdmin.from('warning_appeals').update({
          status: decision, // 'approved' or 'rejected'
          admin_note: admin_note || null,
          reviewed_by: admin_id,
          reviewed_at: new Date().toISOString(),
        }).eq('id', id);
        // Update the warning status too
        await supabaseAdmin.from('user_warnings').update({
          status: decision === 'approved' ? 'overturned' : 'active',
        }).eq('id', warning_id);
        // If approved: restore the 1 TP that was deducted + 1 bonus
        if (decision === 'approved') {
          const { data: current } = await supabaseAdmin.from('account_status').select('trust_points').eq('id', user_id).single();
          const restored = (current?.trust_points ?? 0) + 2; // 1 restored + 1 bonus
          await supabaseAdmin.from('account_status').update({ trust_points: Math.min(restored, 10) }).eq('id', user_id);
          await supabaseAdmin.from('point_transactions').insert([{
            user_id, amount: 2, transaction_type: 'appeal_approved', reason: 'Warning overturned by admin appeal',
          }]);
          await supabaseAdmin.from('notifications').insert([{
            user_id, type: 'audition_update',
            message: `✅ Your warning appeal has been approved! The warning has been overturned and your trust points have been restored (+2 bonus).${admin_note ? ` Admin note: ${admin_note}` : ''}`,
          }]);
        } else {
          await supabaseAdmin.from('notifications').insert([{
            user_id, type: 'audition_update',
            message: `❌ Your warning appeal has been reviewed and rejected. The warning remains on your account.${admin_note ? ` Admin note: ${admin_note}` : ''}`,
          }]);
        }
        return res.json({ ok: true });
      }
      if (action === 'dismiss_flag') {
        const { flag_id, admin_id } = payload;
        await supabaseAdmin.from('user_flags').update({ status: 'dismissed', reviewed_by: admin_id, reviewed_at: new Date().toISOString() }).eq('id', flag_id);
        return res.json({ ok: true });
      }
      if (action === 'admin_post') {
        const { admin_id, admin_name, title, content, post_type } = payload;
        const { error } = await supabaseAdmin.from('announcements').insert([{
          author_id: admin_id,
          author_name: admin_name || 'Admin',
          author_type: 'Admin',
          title, content, post_type: post_type || 'announcement',
          community_id: null,
        }]);
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ ok: true });
      }
      if (action === 'toggle_official') {
        const { is_official } = payload;
        await supabaseAdmin.from('communities').update({ is_official }).eq('id', id);
        return res.json({ ok: true });
      }
      if (action === 'delete_community') {
        const { error } = await supabaseAdmin.from('communities').delete().eq('id', id);
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ ok: true });
      }
      if (action === 'delete_announcement') {
        const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ ok: true });
      }
      if (action === 'toggle_pin') {
        const { pinned } = payload;
        await supabaseAdmin.from('announcements').update({ pinned: !pinned }).eq('id', id);
        return res.json({ ok: true });
      }
      if (action === 'delete_message') {
        const { error } = await supabaseAdmin.from('messages').delete().eq('id', id);
        if (error) return res.status(400).json({ message: error.message });
        return res.json({ ok: true });
      }
      if (action === 'resolve_report') {
        const { status, note, admin_id } = payload;
        await supabaseAdmin.from('reports').update({
          status, admin_note: note, reviewed_at: new Date().toISOString(), reviewed_by: admin_id,
        }).eq('id', id);
        return res.json({ ok: true });
      }
      if (action === 'delete_content') {
        const { content_type } = payload;
        if (content_type === 'message') {
          await supabaseAdmin.from('messages').delete().eq('id', id);
        } else if (content_type === 'announcement') {
          await supabaseAdmin.from('announcements').delete().eq('id', id);
        } else if (content_type === 'profile_photo') {
          await supabaseAdmin.from('account_details').update({ avatar_url: null, cover_url: null }).eq('id', id);
        } else if (content_type === 'circle_photo') {
          await supabaseAdmin.from('communities').update({ cover_url: null }).eq('id', id);
        }
        return res.json({ ok: true });
      }
      return res.status(400).json({ message: 'Unknown action.' });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  if (req.method !== 'GET') return res.status(405).end();

  // Scoped fetch for appeals only
  if (req.query?.type === 'appeals') {
    try {
      const { data } = await supabaseAdmin
        .from('warning_appeals')
        .select('*, accounts:user_id(full_name, ctu_id), user_warnings:warning_id(reason, type, severity)')
        .order('created_at', { ascending: false });
      return res.json({ appeals: data || [] });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

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
