import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SECTIONS = [
  { key: 'analytics',     label: 'Analytics',             icon: 'fa-solid fa-chart-line' },
  { key: 'verification',  label: 'Verification Queue',    icon: 'fa-solid fa-user-check' },
  { key: 'users',         label: 'All Users',             icon: 'fa-solid fa-users' },
  { key: 'communities',   label: 'Circles',               icon: 'fa-solid fa-network-wired' },
  { key: 'events',        label: 'Campus Events',         icon: 'fa-solid fa-calendar-days' },
  { key: 'globalfeed',    label: 'Global Feed',           icon: 'fa-solid fa-message' },
  { key: 'announcements', label: 'Campus Feed Posts',     icon: 'fa-solid fa-bullhorn' },
  { key: 'auditions',     label: 'Audition Applications', icon: 'fa-solid fa-microphone' },
  { key: 'reports',       label: 'Reports',               icon: 'fa-solid fa-flag' },
  { key: 'moderation',    label: 'Content Monitor',       icon: 'fa-solid fa-shield-halved' },
];

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset) {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  if (preset === 'today')  { start.setHours(0, 0, 0, 0); }
  if (preset === 'week')   { start.setDate(now.getDate() - 6); start.setHours(0,0,0,0); }
  if (preset === 'month')  { start.setDate(1); start.setHours(0,0,0,0); }
  if (preset === 'year')   { start = new Date(now.getFullYear(), 0, 1); }
  return { start, end };
}

function countInRange(items, dateField, start, end) {
  return items.filter(i => {
    const d = new Date(i[dateField]);
    return d >= start && d <= end;
  }).length;
}

// Simple bar chart â€” no external lib needed
function MiniBarChart({ data, color }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="analytics-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="analytics-bar-col">
          <div className="analytics-bar-wrap">
            <div
              className="analytics-bar"
              style={{ height: `${Math.round((d.value / max) * 100)}%`, background: color }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <div className="analytics-bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsStatCard({ label, value, sub, color, icon }) {
  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-icon" style={{ background: `${color}18`, color }}>
        <i className={icon}></i>
      </div>
      <div>
        <div className="analytics-stat-val" style={{ color }}>{value}</div>
        <div className="analytics-stat-lbl">{label}</div>
        {sub && <div className="analytics-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-icon" style={{ background: `${color}18`, color }}>
        <i className={icon}></i>
      </div>
      <div>
        <div className="adm-stat-val" style={{ color }}>{value}</div>
        <div className="adm-stat-lbl">{label}</div>
      </div>
    </div>
  );
}

// Inappropriate words filter (basic list â€” expand as needed)
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap', 'puta', 'gago', 'bobo', 'tanga', 'putangina', 'leche', 'pakshet', 'ulol'];

function containsBadWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem('currentUser'));
  const [section, setSection] = useState('analytics');
  const [students, setStudents] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [globalMessages, setGlobalMessages] = useState([]);
  const [auditions, setAuditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [circleMembers, setCircleMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [reports, setReports] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [allCircleAnnouncements, setAllCircleAnnouncements] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // â”€â”€ Analytics state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [preset, setPreset] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]   = useState('');
  const [useCustom, setUseCustom]   = useState(false);

  // â”€â”€ Campus Feed post composer state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [newAdminPost, setNewAdminPost] = useState({ title: '', content: '', post_type: 'announcement' });
  const [postingAdminPost, setPostingAdminPost] = useState(false);
  // -- Campus Events state
  const [campusEvents, setCampusEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', category: 'general', start_date: '', end_date: '' });
  const [postingEvent, setPostingEvent] = useState(false);

  const EVENT_CATS = [
    { key: 'semester',   label: 'Semester',           color: '#facc15' },
    { key: 'exam',       label: 'Exam Schedules',      color: '#f87171' },
    { key: 'enrollment', label: 'Enrollment',          color: '#34d399' },
    { key: 'holiday',    label: 'Holidays',            color: '#fb923c' },
    { key: 'sports',     label: 'Sports / Intramural', color: '#a78bfa' },
    { key: 'cultural',   label: 'Cultural',            color: '#f472b6' },
    { key: 'seminar',    label: 'Seminar',             color: '#22d3ee' },
    { key: 'general',    label: 'General',             color: '#94a3b8' },
  ];

  const loadCampusEvents = async () => {
    setEventsLoading(true);
    const { data } = await supabase.from('campus_events').select('*').order('start_date', { ascending: true });
    setCampusEvents(data || []);
    setEventsLoading(false);
  };

  const submitEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.start_date) return;
    setPostingEvent(true);
    const { error } = await supabase.from('campus_events').insert([{
      title: newEvent.title.trim(),
      description: newEvent.description.trim(),
      category: newEvent.category,
      start_date: newEvent.start_date,
      end_date: newEvent.end_date || newEvent.start_date,
      created_by: admin?.id,
    }]);
    setPostingEvent(false);
    if (!error) {
      setNewEvent({ title: '', description: '', category: 'general', start_date: '', end_date: '' });
      setShowEventForm(false);
      loadCampusEvents();
      showToast('Event added.');
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    await supabase.from('campus_events').delete().eq('id', id);
    loadCampusEvents();
    showToast('Event deleted.');
  };

  const submitAdminPost = async () => {
    if (!newAdminPost.title.trim() || !newAdminPost.content.trim()) return;
    setPostingAdminPost(true);
    const { error } = await supabase.from('announcements').insert([{
      author_id: admin?.id,
      author_name: admin?.full_name || 'Admin',
      author_type: 'Admin',
      title: newAdminPost.title.trim(),
      content: newAdminPost.content.trim(),
      post_type: newAdminPost.post_type,
      community_id: null,
    }]);
    setPostingAdminPost(false);
    if (!error) {
      setNewAdminPost({ title: '', content: '', post_type: 'announcement' });
      showToast('Post published.');
      fetchData();
    } else {
      showToast('Failed to post.');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studRes, commRes, annRes, audRes, msgRes, membRes, repRes, allMsgRes, circAnnRes] = await Promise.all([
        fetch('/api/students'),
        supabase.from('communities').select('*, profiles(full_name)').order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
        supabase.from('audition_responses').select('*, profiles(full_name, student_id), communities(name)').order('submitted_at', { ascending: false }),
        supabase.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
        supabase.from('memberships').select('community_id, status, created_at'),
        supabase.from('reports').select('*, reporter:reporter_id(full_name, student_id), reported:reported_user_id(full_name, student_id)').order('created_at', { ascending: false }),
        supabase.from('messages').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
        supabase.from('announcements').select('*, communities(name)').not('community_id', 'is', null).order('created_at', { ascending: false }).limit(300),
      ]);
      setStudents(await studRes.json());
      setCommunities(commRes.data || []);
      setAnnouncements(annRes.data || []);
      setAuditions(audRes.data || []);
      setGlobalMessages(msgRes.data || []);
      setMemberships(membRes.data || []);
      setReports(repRes.data || []);
      setAllMessages(allMsgRes.data || []);
      setAllCircleAnnouncements(circAnnRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); loadCampusEvents(); }, [fetchData]);

  // Real-time: new reports appear instantly in admin panel
  useEffect(() => {
    const sub = supabase.channel('admin:reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          setReports(prev => [payload.new, ...prev]);
        }
      ).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const viewCircleMembers = async (circle) => {
    setSelectedCircle(circle);
    setLoadingMembers(true);
    const { data } = await supabase.from('memberships')
      .select('*, profiles(full_name, student_id)')
      .eq('community_id', circle.id);
    setCircleMembers(data || []);
    setLoadingMembers(false);
  };

  const approveStudent = async (id, name) => {
    if (!confirm('Approve this student?')) return;
    const res = await fetch(`/api/verify-student?id=${id}`, { method: 'POST' });
    if (res.ok) {
      // Send notification to the student
      await supabase.from('notifications').insert([{
        user_id: id,
        type: 'join_approved',
        message: 'Your account has been verified! You now have full access to NEXO Connect.',
      }]);
      showToast(`${name} approved.`);
      fetchData();
    } else showToast('Failed to approve.');
  };

  const rejectStudent = async (id, name) => {
    if (!confirm(`Reject and remove ${name}?`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) { showToast('Student rejected and removed.'); fetchData(); }
    else showToast('Failed to reject.');
  };

  const deleteCommunity = async (id, name) => {
    if (!confirm(`Delete circle "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (!error) { showToast('Circle deleted.'); fetchData(); setSelectedCircle(null); }
    else showToast('Failed to delete.');
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (!error) { showToast('Post deleted.'); fetchData(); }
  };

  const togglePin = async (id, pinned) => {
    await supabase.from('announcements').update({ pinned: !pinned }).eq('id', id);
    fetchData();
  };

  const deleteMessage = async (id) => {
    if (!confirm('Delete this message?')) return;
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (!error) setGlobalMessages(prev => prev.filter(m => m.id !== id));
  };

  const issueWarning = async (userId, userName, reason) => {
    // Get current trust points
    const { data: profile } = await supabase
      .from('profiles')
      .select('warning_count, trust_points, is_banned')
      .eq('id', userId).single();

    if (profile?.is_banned) { showToast(`${userName} is already banned.`); return; }

    const currentPoints = profile?.trust_points ?? 3;
    const newPoints = Math.max(0, currentPoints - 1);
    const newWarnings = (profile?.warning_count || 0) + 1;
    const willSuspend = newPoints === 0;

    // Insert warning record
    await supabase.from('user_warnings').insert([{
      user_id: userId, admin_id: admin?.id, type: 'warning', reason,
    }]);

    // Compute suspension end date (7 days from now)
    const suspendedUntil = willSuspend
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Update profile
    await supabase.from('profiles').update({
      warning_count: newWarnings,
      trust_points: willSuspend ? 1 : newPoints, // reset to 1 after suspension
      ...(willSuspend ? { suspended_until: suspendedUntil } : {}),
    }).eq('id', userId);

    // Send notification to user
    const notifMsg = willSuspend
      ? `ðŸš« Your account has been suspended for 7 days due to repeated violations. Reason: ${reason}. You can log in again after ${new Date(suspendedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
      : `âš ï¸ Warning from Admin (${newPoints} trust point${newPoints !== 1 ? 's' : ''} remaining): ${reason}. ${newPoints === 1 ? 'One more violation will result in a 7-day suspension.' : ''}`;

    await supabase.from('notifications').insert([{
      user_id: userId,
      type: 'audition_update',
      message: notifMsg,
    }]);

    showToast(willSuspend ? `${userName} suspended for 7 days.` : `Warning issued to ${userName}. ${newPoints} point(s) left.`);
    fetchData();
  };

  const banUser = async (userId, userName) => {
    if (!confirm(`Ban ${userName}? They will lose access to the platform.`)) return;
    const reason = prompt('Reason for ban:');
    if (!reason) return;
    await supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
    await supabase.from('user_warnings').insert([{
      user_id: userId, admin_id: admin?.id, type: 'ban', reason,
    }]);
    await supabase.from('notifications').insert([{
      user_id: userId, type: 'audition_update',
      message: `ðŸš« Your account has been banned: ${reason}`,
    }]);
    showToast(`${userName} has been banned.`);
    fetchData();
  };

  const unbanUser = async (userId, userName) => {
    if (!confirm(`Unban ${userName}?`)) return;
    await supabase.from('profiles').update({ is_banned: false }).eq('id', userId);
    showToast(`${userName} has been unbanned.`);
    fetchData();
  };

  const deleteUser = async (userId, userName) => {
    if (!confirm(`Permanently delete ${userName}? This cannot be undone.`)) return;
    // Delete via server (needs service role)
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/delete-user?id=${userId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        showToast(`${userName} deleted.`);
        setSelectedUser(null);
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.message || 'Failed to delete user.');
      }
    } catch {
      // Fallback: just delete profile
      await supabase.from('profiles').delete().eq('id', userId);
      showToast(`${userName} deleted.`);
      setSelectedUser(null);
      fetchData();
    }
  };

  const forceVerifyEmail = async (userId, userName) => {
    if (!confirm(`Force verify email for ${userName}?`)) return;
    await supabase.from('profiles').update({ is_verified: true }).eq('id', userId);
    showToast(`${userName} verified.`);
    if (selectedUser?.id === userId) setSelectedUser(prev => ({ ...prev, is_verified: true }));
    fetchData();
  };

  const resolveReport = async (reportId, status, note) => {
    await supabase.from('reports').update({
      status, admin_note: note, reviewed_at: new Date().toISOString(), reviewed_by: admin?.id,
    }).eq('id', reportId);
    showToast('Report updated.');
    fetchData();
  };

  const deleteContent = async (type, id) => {
    if (!confirm('Delete this content?')) return;
    if (type === 'message') await supabase.from('messages').delete().eq('id', id);
    if (type === 'announcement') await supabase.from('announcements').delete().eq('id', id);
    showToast('Content deleted.');
    fetchData();
  };

  const rankLabel = (level) => ['Member', 'Moderator', 'Co-Leader', 'Leader'][level ?? 0] || 'Member';
  const rankColor = (level) => {
    if (level >= 3) return 'var(--cyber-yellow)';
    if (level >= 2) return 'var(--cyber-cyan)';
    if (level >= 1) return 'var(--green)';
    return 'var(--text-muted)';
  };

  const pending  = students.filter(s => !s.is_verified);
  const verified = students.filter(s => s.is_verified);
  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(search.toLowerCase())
  );

  // â”€â”€ Analytics computed values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { start: rangeStart, end: rangeEnd } = useCustom && customStart && customEnd
    ? { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') }
    : getPresetRange(preset);

  const newUsers      = countInRange(students,     'created_at',   rangeStart, rangeEnd);
  const newCircles    = countInRange(communities,  'created_at',   rangeStart, rangeEnd);
  const newMembers    = countInRange(memberships,  'created_at',   rangeStart, rangeEnd);
  const newMessages   = countInRange(globalMessages, 'created_at', rangeStart, rangeEnd);
  const newAuditions  = countInRange(auditions,    'submitted_at', rangeStart, rangeEnd);
  const newPosts      = countInRange(announcements,'created_at',   rangeStart, rangeEnd);

  // Build bar chart data â€” split range into buckets
  function buildChartData(items, dateField) {
    const diffDays = Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24));
    const buckets = [];

    if (diffDays <= 1) {
      // hourly buckets for "today"
      for (let h = 0; h < 24; h += 3) {
        const s = new Date(rangeStart); s.setHours(h, 0, 0, 0);
        const e = new Date(rangeStart); e.setHours(h + 2, 59, 59, 999);
        buckets.push({ label: `${String(h).padStart(2,'0')}h`, start: s, end: e });
      }
    } else if (diffDays <= 7) {
      // daily buckets
      for (let d = 0; d <= diffDays; d++) {
        const s = new Date(rangeStart); s.setDate(rangeStart.getDate() + d); s.setHours(0,0,0,0);
        const e = new Date(s); e.setHours(23,59,59,999);
        buckets.push({ label: s.toLocaleDateString('en-US',{weekday:'short'}), start: s, end: e });
      }
    } else if (diffDays <= 31) {
      // every 3 days
      for (let d = 0; d <= diffDays; d += 3) {
        const s = new Date(rangeStart); s.setDate(rangeStart.getDate() + d); s.setHours(0,0,0,0);
        const e = new Date(s); e.setDate(s.getDate() + 2); e.setHours(23,59,59,999);
        buckets.push({ label: `${s.getMonth()+1}/${s.getDate()}`, start: s, end: e });
      }
    } else {
      // monthly buckets
      const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (cursor <= rangeEnd) {
        const s = new Date(cursor);
        const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
        buckets.push({ label: s.toLocaleDateString('en-US',{month:'short'}), start: s, end: e });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    return buckets.map(b => ({
      label: b.label,
      value: countInRange(items, dateField, b.start, b.end),
    }));
  }

  const userChartData    = buildChartData(students,      'created_at');
  const circleChartData  = buildChartData(communities,   'created_at');
  const memberChartData  = buildChartData(memberships,   'created_at');
  const messageChartData = buildChartData(globalMessages,'created_at');

  const rangeLabel = useCustom && customStart && customEnd
    ? `${customStart} â†’ ${customEnd}`
    : { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' }[preset];

  const auditionStatusLabel = (status, phase2Result) => {
    if (status === 'phase2') return phase2Result ? (phase2Result === 'accepted' ? 'Accepted (P2)' : 'Rejected (P2)') : 'Phase 2';
    return { pending: 'Under Review', accepted: 'Accepted', rejected: 'Rejected' }[status] || status;
  };
  const auditionStatusColor = (status, phase2Result) => {
    if (status === 'accepted' || phase2Result === 'accepted') return 'var(--green)';
    if (status === 'rejected' || phase2Result === 'rejected') return 'var(--red)';
    if (status === 'phase2') return 'var(--cyber-yellow)';
    return 'var(--text-muted)';
  };

  return (
    <div className="adm-layout">
      {/* SIDEBAR */}
      <div className="adm-sidebar">
        <div className="adm-brand">
          <img src="/logoo.png" alt="NEXO" style={{ width: 32, height: 32, borderRadius: 8, marginRight: 10, filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.5))' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 2 }}>NEXO</div>
            <div style={{ fontSize: 9, color: 'var(--cyber-cyan)', letterSpacing: 2 }}>ADMIN PANEL</div>
          </div>
        </div>

        <div className="adm-sidebar-label">NAVIGATION</div>
        {SECTIONS.map(s => (
          <div key={s.key} className={`adm-nav-item ${section === s.key ? 'active' : ''}`}
            onClick={() => { setSection(s.key); setSelectedCircle(null); }}>
            <i className={s.icon}></i>
            <span>{s.label}</span>
            {s.key === 'verification' && pending.length > 0 && (
              <span className="adm-badge">{pending.length}</span>
            )}
            {s.key === 'auditions' && auditions.filter(a => a.status === 'pending').length > 0 && (
              <span className="adm-badge">{auditions.filter(a => a.status === 'pending').length}</span>
            )}
            {s.key === 'reports' && reports.filter(r => r.status === 'pending').length > 0 && (
              <span className="adm-badge">{reports.filter(r => r.status === 'pending').length}</span>
            )}
          </div>
        ))}

        <div style={{ marginTop: 'auto' }}>
          <div className="adm-sidebar-label">ACCOUNT</div>
          <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{admin?.full_name}</div>
          <div className="adm-nav-item" onClick={() => { localStorage.removeItem('currentUser'); localStorage.removeItem('accessToken'); navigate('/'); }}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Logout</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="adm-main">
        <div className="adm-topbar">
          <div>
            <h1 className="adm-page-title">
              {selectedCircle ? `${selectedCircle.name} â€” Members` : SECTIONS.find(s => s.key === section)?.label}
            </h1>
            <p className="adm-page-sub">NEXO Connect â€” Admin Control Panel</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {selectedCircle && (
              <button className="adm-refresh-btn" onClick={() => setSelectedCircle(null)}>
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>
            )}
            <button className="adm-refresh-btn" onClick={fetchData}>
              <i className="fa-solid fa-rotate-right"></i> Refresh
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="adm-stats-row">
          <StatCard label="Total Users"    value={students.length}    color="var(--cyber-cyan)"  icon="fa-solid fa-users" />
          <StatCard label="Verified"       value={verified.length}    color="var(--green)"        icon="fa-solid fa-circle-check" />
          <StatCard label="Pending"        value={pending.length}     color="var(--orange)"       icon="fa-solid fa-clock" />
          <StatCard label="Circles"        value={communities.length} color="var(--cyber-yellow)" icon="fa-solid fa-network-wired" />
        </div>

        {/* â”€â”€ ANALYTICS â”€â”€ */}
        {section === 'analytics' && (
          <div>
            {/* Date range controls */}
            <div className="analytics-controls">
              <div className="analytics-presets">
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'week',  label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'year',  label: 'This Year' },
                ].map(p => (
                  <button key={p.key}
                    className={`analytics-preset-btn ${!useCustom && preset === p.key ? 'active' : ''}`}
                    onClick={() => { setPreset(p.key); setUseCustom(false); }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="analytics-custom">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>CUSTOM</span>
                <input type="date" className="analytics-date-input"
                  value={customStart}
                  max={customEnd || toDateInput(new Date())}
                  onChange={e => { setCustomStart(e.target.value); setUseCustom(true); }} />
                <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>â†’</span>
                <input type="date" className="analytics-date-input"
                  value={customEnd}
                  min={customStart}
                  max={toDateInput(new Date())}
                  onChange={e => { setCustomEnd(e.target.value); setUseCustom(true); }} />
              </div>
            </div>

            <div className="analytics-range-label">
              <i className="fa-solid fa-calendar-days" style={{ marginRight: 6 }}></i>
              Showing activity for: <strong style={{ color: 'var(--cyber-cyan)' }}>{rangeLabel}</strong>
            </div>

            {/* Summary stat cards */}
            <div className="analytics-stats-grid">
              <AnalyticsStatCard label="New Users"       value={newUsers}     sub={`of ${students.length} total`}     color="var(--cyber-cyan)"  icon="fa-solid fa-user-plus" />
              <AnalyticsStatCard label="New Circles"     value={newCircles}   sub={`of ${communities.length} total`}  color="var(--cyber-yellow)" icon="fa-solid fa-circle-nodes" />
              <AnalyticsStatCard label="New Memberships" value={newMembers}   sub="circle joins"                      color="var(--green)"        icon="fa-solid fa-user-group" />
              <AnalyticsStatCard label="Messages Sent"   value={newMessages}  sub="global feed"                       color="var(--purple, #a855f7)" icon="fa-solid fa-message" />
              <AnalyticsStatCard label="Auditions Filed" value={newAuditions} sub="applications"                      color="var(--orange)"       icon="fa-solid fa-microphone" />
              <AnalyticsStatCard label="Posts Published" value={newPosts}     sub="campus feed"                       color="var(--red, #ef4444)" icon="fa-solid fa-bullhorn" />
            </div>

            {/* Charts */}
            <div className="analytics-charts-grid">
              <div className="adm-card">
                <div className="adm-card-head">
                  <span>User Registrations</span>
                  <span style={{ fontSize: 11, color: 'var(--cyber-cyan)' }}>{newUsers} in range</span>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {loading ? <div className="adm-empty">Loading...</div>
                  : <MiniBarChart data={userChartData} color="var(--cyber-cyan)" />}
                </div>
              </div>

              <div className="adm-card">
                <div className="adm-card-head">
                  <span>Circle Creations</span>
                  <span style={{ fontSize: 11, color: 'var(--cyber-yellow)' }}>{newCircles} in range</span>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {loading ? <div className="adm-empty">Loading...</div>
                  : <MiniBarChart data={circleChartData} color="var(--cyber-yellow)" />}
                </div>
              </div>

              <div className="adm-card">
                <div className="adm-card-head">
                  <span>Circle Memberships</span>
                  <span style={{ fontSize: 11, color: 'var(--green)' }}>{newMembers} in range</span>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {loading ? <div className="adm-empty">Loading...</div>
                  : <MiniBarChart data={memberChartData} color="var(--green)" />}
                </div>
              </div>

              <div className="adm-card">
                <div className="adm-card-head">
                  <span>Global Messages</span>
                  <span style={{ fontSize: 11, color: '#a855f7' }}>{newMessages} in range</span>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {loading ? <div className="adm-empty">Loading...</div>
                  : <MiniBarChart data={messageChartData} color="#a855f7" />}
                </div>
              </div>
            </div>

            {/* Most active circles in range */}
            <div className="adm-card" style={{ marginTop: 20 }}>
              <div className="adm-card-head">
                <span>Most Active Circles</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by new memberships in range</span>
              </div>
              {loading ? <div className="adm-empty">Loading...</div> : (() => {
                const counts = {};
                memberships
                  .filter(m => { const d = new Date(m.created_at); return d >= rangeStart && d <= rangeEnd; })
                  .forEach(m => { counts[m.community_id] = (counts[m.community_id] || 0) + 1; });
                const ranked = communities
                  .map(c => ({ ...c, joinCount: counts[c.id] || 0 }))
                  .filter(c => c.joinCount > 0)
                  .sort((a, b) => b.joinCount - a.joinCount)
                  .slice(0, 10);
                return ranked.length === 0
                  ? <div className="adm-empty">No circle activity in this period.</div>
                  : (
                    <table className="adm-table">
                      <thead><tr><th>#</th><th>Circle</th><th>Category</th><th>New Members</th><th>Total Members</th></tr></thead>
                      <tbody>
                        {ranked.map((c, i) => {
                          const total = memberships.filter(m => m.community_id === c.id).length;
                          return (
                            <tr key={c.id}>
                              <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>#{i + 1}</td>
                              <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.name}</td>
                              <td><span className="adm-tag">{c.category}</span></td>
                              <td>
                                <span style={{ color: 'var(--green)', fontWeight: 700 }}>+{c.joinCount}</span>
                              </td>
                              <td style={{ color: 'var(--text-muted)' }}>{total}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
              })()}
            </div>
          </div>
        )}

        {/* â”€â”€ VERIFICATION QUEUE â”€â”€ */}
        {section === 'verification' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>Pending Enrollments</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pending.length} awaiting review</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : pending.length === 0 ? (
              <div className="adm-empty">
                <i className="fa-solid fa-circle-check" style={{ fontSize: 32, color: 'var(--green)', marginBottom: 12, display: 'block' }}></i>
                All caught up â€” no pending verifications.
              </div>
            ) : (
              <table className="adm-table">
                <thead><tr><th>CTU ID</th><th>Full Name</th><th>Type</th><th>School ID Photo</th><th>Scanner</th><th>Registered</th><th>Actions</th></tr></thead>
                <tbody>
                  {pending.map(s => (
                    <tr key={s.id}>
                      <td><span className="adm-mono">{s.student_id}</span></td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.full_name}</td>
                      <td><span className="adm-tag">{s.user_type}</span></td>
                      <td>
                        {s.id_photo_url ? (
                          <a href={s.id_photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={s.id_photo_url}
                              alt="School ID"
                              style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 6, border: `1px solid ${s.id_verified ? 'rgba(62,207,142,0.4)' : 'rgba(247,169,79,0.4)'}`, cursor: 'pointer' }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--red)' }}>
                            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
                            No photo
                          </span>
                        )}
                      </td>
                      <td>
                        {!s.id_photo_url ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        ) : s.id_verified ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="fa-solid fa-circle-check"></i> Passed
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="fa-solid fa-triangle-exclamation"></i> Manual
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="adm-btn approve" onClick={() => approveStudent(s.id, s.full_name)}>
                            <i className="fa-solid fa-check"></i> Approve
                          </button>
                          <button className="adm-btn reject" onClick={() => rejectStudent(s.id, s.full_name)}>
                            <i className="fa-solid fa-xmark"></i> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* â”€â”€ ALL USERS â”€â”€ */}
        {section === 'users' && !selectedUser && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>All Registered Users</span>
              <input className="adm-search" placeholder="Search by name or ID..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? <div className="adm-empty">Loading...</div> : (
              <table className="adm-table">
                <thead><tr><th>CTU ID</th><th>Full Name</th><th>Email</th><th>Type</th><th>Status</th><th>Trust</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedUser(s)}>
                      <td><span className="adm-mono">{s.student_id}</span></td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.email}</td>
                      <td><span className="adm-tag">{s.user_type}</span></td>
                      <td>
                        {s.is_banned
                          ? <span className="adm-status" style={{ background: 'rgba(247,95,95,0.1)', color: 'var(--red)', border: '1px solid var(--red)' }}>BANNED</span>
                          : s.suspended_until && new Date(s.suspended_until) > new Date()
                            ? <span className="adm-status" style={{ background: 'rgba(247,169,79,0.1)', color: 'var(--orange)', border: '1px solid var(--orange)' }}>SUSPENDED</span>
                            : <span className={`adm-status ${s.is_verified ? 'verified' : 'pending'}`}>{s.is_verified ? 'Verified' : 'Pending'}</span>
                        }
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: (s.trust_points ?? 3) <= 1 ? 'var(--red)' : (s.trust_points ?? 3) <= 2 ? 'var(--orange)' : 'var(--green)' }}>
                          {s.trust_points ?? 3}/3
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="adm-btn reject" style={{ fontSize: 10 }} onClick={() => deleteUser(s.id, s.full_name)}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {section === 'users' && selectedUser && (
          <div>
            <button className="adm-btn" style={{ marginBottom: 16 }} onClick={() => setSelectedUser(null)}>
              <i className="fa-solid fa-arrow-left"></i> Back to Users
            </button>
            <div className="adm-card">
              <div className="adm-card-head">
                <span>User Profile</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!selectedUser.is_verified && (
                    <button className="adm-btn approve" onClick={() => forceVerifyEmail(selectedUser.id, selectedUser.full_name)}>
                      <i className="fa-solid fa-shield-check"></i> Force Verify Email
                    </button>
                  )}
                  <button className="adm-btn reject" onClick={() => deleteUser(selectedUser.id, selectedUser.full_name)}>
                    <i className="fa-solid fa-trash"></i> Delete User
                  </button>
                </div>
              </div>
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                {/* Left: user info */}
                <div>
                  {[
                    { label: 'FULL NAME',  value: selectedUser.full_name },
                    { label: 'CTU ID',     value: selectedUser.student_id, mono: true },
                    { label: 'EMAIL',      value: selectedUser.email },
                    { label: 'USER TYPE',  value: selectedUser.user_type },
                    { label: 'STATUS',     value: selectedUser.is_banned ? '🚫 Banned' : selectedUser.is_verified ? '✅ Verified' : '⏳ Pending' },
                    { label: 'ID VERIFIED', value: selectedUser.id_photo_url ? '✅ Yes' : '❌ No' },
                    { label: 'JOINED',     value: new Date(selectedUser.created_at).toLocaleString() },
                    { label: 'TRUST POINTS', value: `${selectedUser.trust_points ?? 3}/3` },
                    { label: 'WARNINGS',   value: selectedUser.warning_count || 0 },
                  ].map(({ label, value, mono }) => (
                    <div key={label} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ width: 120, fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>{label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!selectedUser.is_banned && selectedUser.is_verified && (
                      <button className="adm-btn" style={{ color: 'var(--orange)', borderColor: 'var(--orange)', background: 'rgba(247,169,79,0.08)' }}
                        onClick={() => { const r = prompt('Warning reason:'); if (r) { issueWarning(selectedUser.id, selectedUser.full_name, r); setSelectedUser(prev => ({ ...prev, warning_count: (prev.warning_count || 0) + 1, trust_points: Math.max(0, (prev.trust_points ?? 3) - 1) })); } }}>
                        <i className="fa-solid fa-triangle-exclamation"></i> Issue Warning
                      </button>
                    )}
                    {selectedUser.is_banned
                      ? <button className="adm-btn approve" onClick={() => { unbanUser(selectedUser.id, selectedUser.full_name); setSelectedUser(prev => ({ ...prev, is_banned: false })); }}>
                          <i className="fa-solid fa-unlock"></i> Unban
                        </button>
                      : selectedUser.is_verified && (
                        <button className="adm-btn reject" onClick={() => { banUser(selectedUser.id, selectedUser.full_name); setSelectedUser(prev => ({ ...prev, is_banned: true })); }}>
                          <i className="fa-solid fa-ban"></i> Ban User
                        </button>
                      )
                    }
                  </div>
                </div>
                {/* Right: ID photo */}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>SCHOOL ID PHOTO</div>
                  {selectedUser.id_photo_url ? (
                    <a href={selectedUser.id_photo_url} target="_blank" rel="noreferrer">
                      <img src={selectedUser.id_photo_url} alt="School ID"
                        style={{ width: '100%', maxWidth: 360, borderRadius: 10, border: '1px solid rgba(0,240,255,0.2)', cursor: 'zoom-in', objectFit: 'contain', background: '#000' }} />
                    </a>
                  ) : (
                    <div style={{ width: '100%', maxWidth: 360, height: 200, borderRadius: 10, border: '2px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      <div style={{ textAlign: 'center' }}>
                        <i className="fa-solid fa-id-card" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}></i>
                        No ID photo uploaded
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ CIRCLES â”€â”€ */}
        {section === 'communities' && !selectedCircle && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>All Circles</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{communities.length} total</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : communities.length === 0 ? <div className="adm-empty">No circles found.</div>
            : (
              <table className="adm-table">
                <thead><tr><th>Name</th><th>Category</th><th>Audition</th><th>Created By</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {communities.map(c => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => viewCircleMembers(c)}>
                        {c.name}
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginLeft: 6, fontSize: 10, color: 'var(--cyber-cyan)' }}></i>
                      </td>
                      <td><span className="adm-tag">{c.category}</span></td>
                      <td>
                        <span style={{ fontSize: 11, color: c.audition_enabled ? 'var(--green)' : 'var(--text-muted)' }}>
                          <i className={`fa-solid ${c.audition_enabled ? 'fa-microphone' : 'fa-microphone-slash'}`} style={{ marginRight: 4 }}></i>
                          {c.audition_enabled ? 'On' : 'Off'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.profiles?.full_name || 'â€”'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="adm-btn approve" onClick={() => viewCircleMembers(c)}>
                            <i className="fa-solid fa-users"></i> Members
                          </button>
                          <button className="adm-btn reject" onClick={() => deleteCommunity(c.id, c.name)}>
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* â”€â”€ CIRCLE MEMBERS DETAIL â”€â”€ */}
        {section === 'communities' && selectedCircle && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>Members of {selectedCircle.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{circleMembers.length} members</span>
            </div>
            {loadingMembers ? <div className="adm-empty">Loading...</div>
            : circleMembers.length === 0 ? <div className="adm-empty">No members yet.</div>
            : (
              <table className="adm-table">
                <thead><tr><th>Full Name</th><th>Student ID</th><th>Rank</th><th>Status</th></tr></thead>
                <tbody>
                  {circleMembers.map(m => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.profiles?.full_name || 'â€”'}</td>
                      <td><span className="adm-mono">{m.profiles?.student_id || 'â€”'}</span></td>
                      <td><span style={{ color: rankColor(m.rank_level), fontSize: 12, fontWeight: 700 }}>{rankLabel(m.rank_level)}</span></td>
                      <td><span className={`adm-status ${m.status === 'active' ? 'verified' : 'pending'}`}>{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* â”€â”€ GLOBAL FEED MESSAGES â”€â”€ */}
        {section === 'globalfeed' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>Global Feed Messages</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 50 messages</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : globalMessages.length === 0 ? <div className="adm-empty">No messages yet.</div>
            : (
              <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              <table className="adm-table">
                <thead><tr><th>Author</th><th>Message</th><th>Sent</th><th>Actions</th></tr></thead>
                <tbody>
                  {globalMessages.map(m => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.full_name}</td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 300 }}>{m.content}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString()}</td>
                      <td>
                        <button className="adm-btn reject" onClick={() => deleteMessage(m.id)}>
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ CAMPUS FEED POSTS â”€â”€ */}
        {section === 'announcements' && (
          <div>
            {/* Admin post composer */}
            <div className="adm-card" style={{ marginBottom: 16 }}>
              <div className="adm-card-head">
                <span><i className="fa-solid fa-pen-to-square" style={{ marginRight: 8 }}></i>New Campus Post</span>
              </div>
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  className="adm-search" style={{ width: '100%' }}
                  placeholder="Title"
                  value={newAdminPost.title}
                  onChange={e => setNewAdminPost(p => ({ ...p, title: e.target.value }))}
                />
                <textarea
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 80 }}
                  placeholder="Write your announcement, event, or shoutout..."
                  value={newAdminPost.content}
                  onChange={e => setNewAdminPost(p => ({ ...p, content: e.target.value }))}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { key: 'announcement', label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
                      { key: 'event',        label: 'Event',         color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
                      { key: 'shoutout',     label: 'Shoutout',      color: 'var(--green)',        icon: 'fa-solid fa-star' },
                      { key: 'general',      label: 'General',       color: 'var(--text-muted)',   icon: 'fa-solid fa-comment' },
                    ].map(t => (
                      <button key={t.key}
                        onClick={() => setNewAdminPost(p => ({ ...p, post_type: t.key }))}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1px solid ${newAdminPost.post_type === t.key ? t.color : '#333'}`,
                          background: newAdminPost.post_type === t.key ? `${t.color}18` : 'transparent',
                          color: newAdminPost.post_type === t.key ? t.color : 'var(--text-muted)',
                        }}>
                        <i className={t.icon} style={{ marginRight: 5 }}></i>{t.label}
                      </button>
                    ))}
                  </div>
                  <button className="adm-btn approve" style={{ marginLeft: 'auto' }}
                    disabled={postingAdminPost || !newAdminPost.title.trim() || !newAdminPost.content.trim()}
                    onClick={submitAdminPost}>
                    {postingAdminPost
                      ? <><i className="fa-solid fa-spinner fa-spin"></i> Posting...</>
                      : <><i className="fa-solid fa-paper-plane"></i> Post</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Posts list */}
            <div className="adm-card">
              <div className="adm-card-head">
                <span>All Campus Posts</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{announcements.length} posts</span>
              </div>
              {loading ? <div className="adm-empty">Loading...</div>
              : announcements.length === 0 ? <div className="adm-empty">No posts yet.</div>
              : (
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {announcements.map(a => {
                    const typeMap = {
                      announcement: { label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
                      event:        { label: 'Event',         color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
                      shoutout:     { label: 'Shoutout',      color: 'var(--green)',        icon: 'fa-solid fa-star' },
                      general:      { label: 'General',       color: 'var(--text-muted)',   icon: 'fa-solid fa-comment' },
                    };
                    const type = typeMap[a.post_type] || typeMap.general;
                    const isAnon = a.author_name === 'Anonymous';
                    // Admin can see the real poster even for anonymous posts
                    const realAuthor = isAnon
                      ? students.find(s => s.id === a.author_id)
                      : null;
                    return (
                      <div key={a.id} style={{
                        background: a.pinned ? 'rgba(252,238,10,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${a.pinned ? 'rgba(252,238,10,0.2)' : 'rgba(0,240,255,0.06)'}`,
                        borderRadius: 10, padding: '14px 18px',
                      }}>
                        {a.pinned && (
                          <div style={{ fontSize: 10, color: 'var(--cyber-yellow)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
                            <i className="fa-solid fa-thumbtack" style={{ marginRight: 5 }}></i>PINNED
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              {/* Avatar */}
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800,
                                background: isAnon ? 'rgba(168,85,247,0.15)' : 'rgba(0,240,255,0.12)',
                                border: `1px solid ${isAnon ? 'rgba(168,85,247,0.4)' : 'rgba(0,240,255,0.25)'}`,
                                color: isAnon ? '#a855f7' : 'var(--cyber-cyan)',
                              }}>
                                {isAnon
                                  ? <i className="fa-solid fa-user-secret" style={{ fontSize: 12 }}></i>
                                  : (a.author_name || 'A')[0].toUpperCase()}
                              </div>

                              {/* Name + anon reveal */}
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 13, color: isAnon ? '#a855f7' : 'white' }}>
                                  {isAnon ? 'Anonymous' : a.author_name}
                                </span>
                                {isAnon && realAuthor && (
                                  <span style={{ fontSize: 10, color: '#888', marginLeft: 6, fontStyle: 'italic' }}>
                                    (actually: <span style={{ color: 'var(--cyber-cyan)' }}>{realAuthor.full_name}</span>
                                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{realAuthor.student_id}</span>)
                                  </span>
                                )}
                              </div>

                              {isAnon && (
                                <span style={{ fontSize: 10, color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)', padding: '1px 7px', borderRadius: 10, fontStyle: 'italic' }}>
                                  <i className="fa-solid fa-user-secret" style={{ marginRight: 4 }}></i>anonymous
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: type.color, border: `1px solid ${type.color}`, padding: '1px 7px', borderRadius: 10 }}>
                                <i className={type.icon} style={{ marginRight: 4 }}></i>{type.label}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>{a.title}</div>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{a.content}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button className="adm-btn" style={{ color: a.pinned ? 'var(--cyber-yellow)' : 'var(--text-muted)', borderColor: a.pinned ? 'var(--cyber-yellow)' : '#333' }}
                              onClick={() => togglePin(a.id, a.pinned)} title={a.pinned ? 'Unpin' : 'Pin'}>
                              <i className="fa-solid fa-thumbtack"></i>
                            </button>
                            <button className="adm-btn reject" onClick={() => deleteAnnouncement(a.id)}>
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ AUDITION APPLICATIONS â”€â”€ */}
        {section === 'auditions' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>All Audition Applications</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{auditions.length} total</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : auditions.length === 0 ? <div className="adm-empty">No audition applications yet.</div>
            : (
              <table className="adm-table">
                <thead><tr><th>Applicant</th><th>Student ID</th><th>Circle</th><th>Status</th><th>Submitted</th></tr></thead>
                <tbody>
                  {auditions.map(a => (
                    <tr key={a.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.profiles?.full_name || 'â€”'}</td>
                      <td><span className="adm-mono">{a.profiles?.student_id || 'â€”'}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{a.communities?.name || 'â€”'}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          color: auditionStatusColor(a.status, a.phase2_result),
                          border: `1px solid ${auditionStatusColor(a.status, a.phase2_result)}`,
                          background: `${auditionStatusColor(a.status, a.phase2_result)}15`
                        }}>
                          {auditionStatusLabel(a.status, a.phase2_result)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(a.submitted_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        
        {/* -- CAMPUS EVENTS -- */}
        {section === 'events' && (
          <div>
            <div className="adm-card" style={{ marginBottom: 16 }}>
              <div className="adm-card-head">
                <span><i className="fa-solid fa-calendar-plus" style={{ marginRight: 8 }}></i>Campus Events</span>
                <button className="adm-btn approve" onClick={() => setShowEventForm(o => !o)}>
                  <i className={`fa-solid ${showEventForm ? 'fa-xmark' : 'fa-plus'}`}></i>
                  {showEventForm ? ' Cancel' : ' Add Event'}
                </button>
              </div>
              {showEventForm && (
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="adm-search" style={{ width: '100%' }} placeholder="Event title"
                    value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
                  <textarea style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, outline: 'none', height: 60, resize: 'none' }}
                    placeholder="Description (optional)"
                    value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select className="adm-search" style={{ flex: 1 }} value={newEvent.category}
                      onChange={e => setNewEvent(p => ({ ...p, category: e.target.value }))}>
                      {EVENT_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <input type="date" className="analytics-date-input" style={{ flex: 1 }}
                      value={newEvent.start_date} onChange={e => setNewEvent(p => ({ ...p, start_date: e.target.value }))} />
                    <input type="date" className="analytics-date-input" style={{ flex: 1 }}
                      value={newEvent.end_date} onChange={e => setNewEvent(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                  <button className="adm-btn approve" onClick={submitEvent} disabled={postingEvent || !newEvent.title.trim() || !newEvent.start_date}>
                    <i className="fa-solid fa-calendar-plus"></i> {postingEvent ? 'Adding...' : 'Add Event'}
                  </button>
                </div>
              )}
            </div>
            <div className="adm-card">
              <div className="adm-card-head">
                <span>All Campus Events</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{campusEvents.length} events</span>
              </div>
              {eventsLoading ? <div className="adm-empty">Loading...</div>
              : campusEvents.length === 0 ? <div className="adm-empty">No events yet. Add one above.</div>
              : (
                <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                <table className="adm-table">
                  <thead><tr><th>TITLE</th><th>CATEGORY</th><th>START</th><th>END</th><th>ACTION</th></tr></thead>
                  <tbody>
                    {campusEvents.map(ev => {
                      const cat = EVENT_CATS.find(c => c.key === ev.category) || EVENT_CATS[EVENT_CATS.length - 1];
                      return (
                        <tr key={ev.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{ev.title}</td>
                          <td><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: cat.color, border: `1px solid ${cat.color}`, background: `${cat.color}15` }}>{cat.label}</span></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(ev.start_date).toLocaleDateString()}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ev.end_date ? new Date(ev.end_date).toLocaleDateString() : '-'}</td>
                          <td><button className="adm-btn reject" style={{ fontSize: 10 }} onClick={() => deleteEvent(ev.id)}><i className="fa-solid fa-trash"></i></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}
{/* â”€â”€ REPORTS â”€â”€ */}
        {section === 'reports' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>User Reports</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {reports.filter(r => r.status === 'pending').length} pending
              </span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : reports.length === 0 ? (
              <div className="adm-empty">No reports yet.</div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '65vh' }}>
              <table className="adm-table">
                <thead>
                  <tr><th>REPORTED BY</th><th>REPORTED USER</th><th>TYPE</th><th>REASON</th><th>CONTENT</th><th>STATUS</th><th>ACTIONS</th></tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 11 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.reporter?.full_name || 'â€”'}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{r.reporter?.student_id}</div>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.reported?.full_name || 'â€”'}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{r.reported?.student_id}</div>
                      </td>
                      <td><span className="adm-tag">{r.content_type}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 160 }}>{r.reason}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.content_preview || 'â€”'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          color: r.status === 'pending' ? 'var(--orange)' : r.status === 'reviewed' ? 'var(--green)' : 'var(--text-muted)',
                          border: `1px solid ${r.status === 'pending' ? 'var(--orange)' : r.status === 'reviewed' ? 'var(--green)' : '#333'}` }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {r.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {r.reported_user_id && (
                              <>
                                <button className="adm-btn" style={{ color: 'var(--orange)', borderColor: 'var(--orange)', background: 'rgba(247,169,79,0.08)', fontSize: 10 }}
                                  onClick={() => {
                                    const reason = prompt('Warning reason:');
                                    if (reason) issueWarning(r.reported_user_id, r.reported?.full_name, reason);
                                    resolveReport(r.id, 'reviewed', 'Warning issued');
                                  }}>
                                  <i className="fa-solid fa-triangle-exclamation"></i> Warn
                                </button>
                                <button className="adm-btn reject" style={{ fontSize: 10 }}
                                  onClick={() => {
                                    banUser(r.reported_user_id, r.reported?.full_name);
                                    resolveReport(r.id, 'reviewed', 'User banned');
                                  }}>
                                  <i className="fa-solid fa-ban"></i> Ban
                                </button>
                              </>
                            )}
                            {r.content_id && (
                              <button className="adm-btn reject" style={{ fontSize: 10 }}
                                onClick={() => {
                                  deleteContent(r.content_type, r.content_id);
                                  resolveReport(r.id, 'reviewed', 'Content deleted');
                                }}>
                                <i className="fa-solid fa-trash"></i> Delete
                              </button>
                            )}
                            <button className="adm-btn" style={{ color: 'var(--text-muted)', borderColor: '#333', fontSize: 10 }}
                              onClick={() => resolveReport(r.id, 'dismissed', 'Dismissed by admin')}>
                              Dismiss
                            </button>
                          </div>
                        )}
                        {r.status !== 'pending' && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.admin_note || 'â€”'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}
        {/* â”€â”€ CONTENT MONITOR â”€â”€ */}
        {section === 'moderation' && (() => {
          const flaggedMessages = allMessages.filter(m => containsBadWord(m.content));
          const flaggedAnnouncements = allCircleAnnouncements.filter(a => containsBadWord(a.title) || containsBadWord(a.content));
          const flaggedGlobal = globalMessages.filter(m => containsBadWord(m.content));
          const allFlagged = [
            ...flaggedMessages.map(m => ({ ...m, _type: 'circle_message', _circle: m.communities?.name })),
            ...flaggedAnnouncements.map(a => ({ ...a, _type: 'announcement', _circle: a.communities?.name })),
            ...flaggedGlobal.map(m => ({ ...m, _type: 'global_message', _circle: 'Global Feed' })),
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Warning stats */}
              <div className="adm-stats-row">
                <div className="adm-stat-card">
                  <div className="adm-stat-icon" style={{ background: 'rgba(247,169,79,0.15)', color: 'var(--orange)' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div>
                    <div className="adm-stat-val" style={{ color: 'var(--orange)' }}>{allFlagged.length}</div>
                    <div className="adm-stat-lbl">Flagged Content</div>
                  </div>
                </div>
                <div className="adm-stat-card">
                  <div className="adm-stat-icon" style={{ background: 'rgba(247,95,95,0.15)', color: 'var(--red)' }}>
                    <i className="fa-solid fa-ban"></i>
                  </div>
                  <div>
                    <div className="adm-stat-val" style={{ color: 'var(--red)' }}>
                      {students.filter(s => s.is_banned).length}
                    </div>
                    <div className="adm-stat-lbl">Banned Users</div>
                  </div>
                </div>
                <div className="adm-stat-card">
                  <div className="adm-stat-icon" style={{ background: 'rgba(252,238,10,0.15)', color: 'var(--cyber-yellow)' }}>
                    <i className="fa-solid fa-flag"></i>
                  </div>
                  <div>
                    <div className="adm-stat-val" style={{ color: 'var(--cyber-yellow)' }}>
                      {reports.filter(r => r.status === 'pending').length}
                    </div>
                    <div className="adm-stat-lbl">Pending Reports</div>
                  </div>
                </div>
              </div>

              {/* Flagged content */}
              <div className="adm-card">
                <div className="adm-card-head">
                  <span><i className="fa-solid fa-robot" style={{ marginRight: 8, color: 'var(--orange)' }}></i>Auto-Detected Inappropriate Content</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{allFlagged.length} flagged</span>
                </div>
                {allFlagged.length === 0 ? (
                  <div className="adm-empty">
                    <i className="fa-solid fa-shield-halved" style={{ fontSize: 28, color: 'var(--green)', marginBottom: 10, display: 'block' }}></i>
                    No inappropriate content detected.
                  </div>
                ) : (
                  <table className="adm-table">
                    <thead><tr><th>TYPE</th><th>CIRCLE</th><th>CONTENT</th><th>AUTHOR</th><th>DATE</th><th>ACTION</th></tr></thead>
                    <tbody>
                      {allFlagged.map((item, i) => {
                        const content = item.content || item.title || '';
                        const highlighted = content.replace(
                          new RegExp(BAD_WORDS.join('|'), 'gi'),
                          match => `[${match}]`
                        );
                        return (
                          <tr key={i}>
                            <td><span className="adm-tag" style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }}>
                              {item._type === 'global_message' ? 'Global' : item._type === 'announcement' ? 'Post' : 'Message'}
                            </span></td>
                            <td style={{ fontSize: 11, color: 'var(--cyber-cyan)' }}>{item._circle || 'â€”'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-primary)', maxWidth: 280 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {highlighted}
                              </div>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {item.full_name || item.author_name || 'â€”'}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              <button className="adm-btn reject" style={{ fontSize: 10 }}
                                onClick={() => deleteContent(
                                  item._type === 'announcement' ? 'announcement' : 'message',
                                  item.id
                                )}>
                                <i className="fa-solid fa-trash"></i> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* User warnings history */}
              <div className="adm-card">
                <div className="adm-card-head">
                  <span>Users with Warnings / Bans</span>
                </div>
                {(() => {
                  const warnedUsers = students.filter(s => s.warning_count > 0 || s.is_banned);
                  return warnedUsers.length === 0 ? (
                    <div className="adm-empty">No warnings or bans issued yet.</div>
                  ) : (
                    <table className="adm-table">
                      <thead><tr><th>CTU ID</th><th>NAME</th><th>WARNINGS</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                      <tbody>
                        {warnedUsers.map(s => (
                          <tr key={s.id}>
                            <td><span className="adm-mono">{s.student_id}</span></td>
                            <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.full_name}</td>
                            <td>
                              <span style={{ color: s.warning_count >= 3 ? 'var(--red)' : 'var(--orange)', fontWeight: 700 }}>
                                {s.warning_count || 0} warning{s.warning_count !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td>
                              {s.is_banned
                                ? <span className="adm-status" style={{ background: 'rgba(247,95,95,0.1)', color: 'var(--red)', border: '1px solid var(--red)' }}>BANNED</span>
                                : <span className="adm-status verified">ACTIVE</span>
                              }
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {!s.is_banned && (
                                  <>
                                    <button className="adm-btn" style={{ color: 'var(--orange)', borderColor: 'var(--orange)', background: 'rgba(247,169,79,0.08)', fontSize: 10 }}
                                      onClick={() => { const r = prompt('Warning reason:'); if (r) issueWarning(s.id, s.full_name, r); }}>
                                      <i className="fa-solid fa-triangle-exclamation"></i> Warn
                                    </button>
                                    <button className="adm-btn reject" style={{ fontSize: 10 }}
                                      onClick={() => banUser(s.id, s.full_name)}>
                                      <i className="fa-solid fa-ban"></i> Ban
                                    </button>
                                  </>
                                )}
                                {s.is_banned && (
                                  <button className="adm-btn approve" style={{ fontSize: 10 }}
                                    onClick={() => unbanUser(s.id, s.full_name)}>
                                    <i className="fa-solid fa-unlock"></i> Unban
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}




