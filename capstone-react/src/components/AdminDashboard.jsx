import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SECTIONS = [
  { key: 'analytics',     label: 'Analytics',             icon: 'fa-solid fa-chart-line' },
  { key: 'verification',  label: 'Verification Queue',    icon: 'fa-solid fa-user-check' },
  { key: 'users',         label: 'All Users',             icon: 'fa-solid fa-users' },
  { key: 'communities',   label: 'Circles',               icon: 'fa-solid fa-network-wired' },
  { key: 'globalfeed',    label: 'Global Feed',           icon: 'fa-solid fa-message' },
  { key: 'announcements', label: 'Campus Feed Posts',     icon: 'fa-solid fa-bullhorn' },
  { key: 'auditions',     label: 'Audition Applications', icon: 'fa-solid fa-microphone' },
];

// ── helpers ──────────────────────────────────────────────────────────────────
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

// Simple bar chart — no external lib needed
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

  // ── Analytics state ──────────────────────────────────────────────────────
  const [preset, setPreset] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]   = useState('');
  const [useCustom, setUseCustom]   = useState(false);

  // ── Campus Feed post composer state ──────────────────────────────────────
  const [newAdminPost, setNewAdminPost] = useState({ title: '', content: '', post_type: 'announcement' });
  const [postingAdminPost, setPostingAdminPost] = useState(false);

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
      const [studRes, commRes, annRes, audRes, msgRes, membRes] = await Promise.all([
        fetch('/api/students'),
        supabase.from('communities').select('*, profiles(full_name)').order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
        supabase.from('audition_responses').select('*, profiles(full_name, student_id), communities(name)').order('submitted_at', { ascending: false }),
        supabase.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
        supabase.from('memberships').select('community_id, status, created_at'),
      ]);
      setStudents(await studRes.json());
      setCommunities(commRes.data || []);
      setAnnouncements(annRes.data || []);
      setAuditions(audRes.data || []);
      setGlobalMessages(msgRes.data || []);
      setMemberships(membRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const res = await fetch(`/api/verify-student/${id}`, { method: 'POST' });
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

  // ── Analytics computed values ─────────────────────────────────────────────
  const { start: rangeStart, end: rangeEnd } = useCustom && customStart && customEnd
    ? { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') }
    : getPresetRange(preset);

  const newUsers      = countInRange(students,     'created_at',   rangeStart, rangeEnd);
  const newCircles    = countInRange(communities,  'created_at',   rangeStart, rangeEnd);
  const newMembers    = countInRange(memberships,  'created_at',   rangeStart, rangeEnd);
  const newMessages   = countInRange(globalMessages, 'created_at', rangeStart, rangeEnd);
  const newAuditions  = countInRange(auditions,    'submitted_at', rangeStart, rangeEnd);
  const newPosts      = countInRange(announcements,'created_at',   rangeStart, rangeEnd);

  // Build bar chart data — split range into buckets
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
    ? `${customStart} → ${customEnd}`
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
            <div style={{ fontSize: 13, fontWeight: 800, color: 'white', letterSpacing: 2 }}>NEXO</div>
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
              {selectedCircle ? `${selectedCircle.name} — Members` : SECTIONS.find(s => s.key === section)?.label}
            </h1>
            <p className="adm-page-sub">NEXO Connect — Admin Control Panel</p>
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

        {/* ── ANALYTICS ── */}
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
                <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
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
                              <td style={{ color: 'white', fontWeight: 600 }}>{c.name}</td>
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

        {/* ── VERIFICATION QUEUE ── */}
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
                All caught up — no pending verifications.
              </div>
            ) : (
              <table className="adm-table">
                <thead><tr><th>CTU ID</th><th>Full Name</th><th>Email</th><th>Type</th><th>Registered</th><th>Actions</th></tr></thead>
                <tbody>
                  {pending.map(s => (
                    <tr key={s.id}>
                      <td><span className="adm-mono">{s.student_id}</span></td>
                      <td style={{ color: 'white', fontWeight: 600 }}>{s.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.email}</td>
                      <td><span className="adm-tag">{s.user_type}</span></td>
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

        {/* ── ALL USERS ── */}
        {section === 'users' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>All Registered Users</span>
              <input className="adm-search" placeholder="Search by name or ID..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? <div className="adm-empty">Loading...</div> : (
              <table className="adm-table">
                <thead><tr><th>CTU ID</th><th>Full Name</th><th>Email</th><th>Type</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td><span className="adm-mono">{s.student_id}</span></td>
                      <td style={{ color: 'white', fontWeight: 600 }}>{s.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.email}</td>
                      <td><span className="adm-tag">{s.user_type}</span></td>
                      <td><span className={`adm-status ${s.is_verified ? 'verified' : 'pending'}`}>{s.is_verified ? 'Verified' : 'Pending'}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── CIRCLES ── */}
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
                      <td style={{ color: 'white', fontWeight: 600, cursor: 'pointer' }}
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
                      <td style={{ color: 'var(--text-muted)' }}>{c.profiles?.full_name || '—'}</td>
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

        {/* ── CIRCLE MEMBERS DETAIL ── */}
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
                      <td style={{ color: 'white', fontWeight: 600 }}>{m.profiles?.full_name || '—'}</td>
                      <td><span className="adm-mono">{m.profiles?.student_id || '—'}</span></td>
                      <td><span style={{ color: rankColor(m.rank_level), fontSize: 12, fontWeight: 700 }}>{rankLabel(m.rank_level)}</span></td>
                      <td><span className={`adm-status ${m.status === 'active' ? 'verified' : 'pending'}`}>{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── GLOBAL FEED MESSAGES ── */}
        {section === 'globalfeed' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>Global Feed Messages</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 50 messages</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : globalMessages.length === 0 ? <div className="adm-empty">No messages yet.</div>
            : (
              <table className="adm-table">
                <thead><tr><th>Author</th><th>Message</th><th>Sent</th><th>Actions</th></tr></thead>
                <tbody>
                  {globalMessages.map(m => (
                    <tr key={m.id}>
                      <td style={{ color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.full_name}</td>
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
            )}
          </div>
        )}

        {/* ── CAMPUS FEED POSTS ── */}
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
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 6, padding: '8px 12px', color: 'white', fontFamily: 'inherit', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 80 }}
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
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 6 }}>{a.title}</div>
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

        {/* ── AUDITION APPLICATIONS ── */}
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
                      <td style={{ color: 'white', fontWeight: 600 }}>{a.profiles?.full_name || '—'}</td>
                      <td><span className="adm-mono">{a.profiles?.student_id || '—'}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{a.communities?.name || '—'}</td>
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
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
