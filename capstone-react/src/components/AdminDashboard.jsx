import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SECTIONS = [
  { key: 'verification',  label: 'Verification Queue',   icon: 'fa-solid fa-user-check' },
  { key: 'users',         label: 'All Users',             icon: 'fa-solid fa-users' },
  { key: 'communities',   label: 'Circles',               icon: 'fa-solid fa-network-wired' },
  { key: 'globalfeed',    label: 'Global Feed',           icon: 'fa-solid fa-message' },
  { key: 'announcements', label: 'Campus Feed Posts',     icon: 'fa-solid fa-bullhorn' },
  { key: 'auditions',     label: 'Audition Applications', icon: 'fa-solid fa-microphone' },
];

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
  const [section, setSection] = useState('verification');
  const [students, setStudents] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [globalMessages, setGlobalMessages] = useState([]);
  const [auditions, setAuditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [circleMembers, setCircleMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studRes, commRes, annRes, audRes, msgRes] = await Promise.all([
        fetch('/api/students'),
        supabase.from('communities').select('*, profiles(full_name)').order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').is('community_id', null).order('created_at', { ascending: false }),
        supabase.from('audition_responses').select('*, profiles(full_name, student_id), communities(name)').order('submitted_at', { ascending: false }),
        supabase.from('messages').select('*').is('community_id', null).order('created_at', { ascending: false }).limit(50),
      ]);
      setStudents(await studRes.json());
      setCommunities(commRes.data || []);
      setAnnouncements(annRes.data || []);
      setAuditions(audRes.data || []);
      setGlobalMessages(msgRes.data || []);
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
          <div className="adm-card">
            <div className="adm-card-head">
              <span>Campus Feed Posts</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{announcements.length} posts</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div>
            : announcements.length === 0 ? <div className="adm-empty">No posts yet.</div>
            : (
              <table className="adm-table">
                <thead><tr><th>Title</th><th>Author</th><th>Type</th><th>Pinned</th><th>Posted</th><th>Actions</th></tr></thead>
                <tbody>
                  {announcements.map(a => (
                    <tr key={a.id}>
                      <td style={{ color: 'white', fontWeight: 600 }}>{a.title}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{a.author_name}</td>
                      <td><span className="adm-tag">{a.post_type || 'general'}</span></td>
                      <td>
                        <button className="adm-btn" style={{ color: a.pinned ? 'var(--cyber-yellow)' : 'var(--text-muted)', borderColor: a.pinned ? 'var(--cyber-yellow)' : '#333' }}
                          onClick={() => togglePin(a.id, a.pinned)}>
                          <i className="fa-solid fa-thumbtack"></i> {a.pinned ? 'Unpin' : 'Pin'}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="adm-btn reject" onClick={() => deleteAnnouncement(a.id)}>
                          <i className="fa-solid fa-trash-can"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
