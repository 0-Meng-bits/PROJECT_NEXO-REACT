import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SECTIONS = [
  { key: 'verification', label: 'Verification Queue', icon: 'fa-solid fa-user-check' },
  { key: 'users',        label: 'All Users',          icon: 'fa-solid fa-users' },
  { key: 'communities',  label: 'Communities',         icon: 'fa-solid fa-circle-nodes' },
  { key: 'reports',      label: 'Reports',             icon: 'fa-solid fa-flag' },
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
  const [section, setSection] = useState('verification');
  const [students, setStudents] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studRes, commRes] = await Promise.all([
        fetch('/api/students'),
        supabase.from('communities').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      ]);
      const studData = await studRes.json();
      setStudents(studData);
      setCommunities(commRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approveStudent = async (id) => {
    if (!confirm('Approve this student?')) return;
    const res = await fetch(`/api/verify-student/${id}`, { method: 'POST' });
    if (res.ok) { showToast('Student approved.'); fetchData(); }
    else showToast('Failed to approve.');
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
    if (!error) { showToast('Circle deleted.'); fetchData(); }
    else showToast('Failed to delete.');
  };

  const pending   = students.filter(s => !s.is_verified);
  const verified  = students.filter(s => s.is_verified);
  const filtered  = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(search.toLowerCase())
  );

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
            onClick={() => setSection(s.key)}>
            <i className={s.icon}></i>
            <span>{s.label}</span>
            {s.key === 'verification' && pending.length > 0 && (
              <span className="adm-badge">{pending.length}</span>
            )}
          </div>
        ))}

        <div style={{ marginTop: 'auto' }}>
          <div className="adm-sidebar-label">ACCOUNT</div>
          <div className="adm-nav-item" onClick={() => { localStorage.removeItem('currentUser'); navigate('/'); }}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Logout</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="adm-main">

        {/* TOP BAR */}
        <div className="adm-topbar">
          <div>
            <h1 className="adm-page-title">
              {SECTIONS.find(s => s.key === section)?.label}
            </h1>
            <p className="adm-page-sub">NEXO Connect — Admin Control Panel</p>
          </div>
          <button className="adm-refresh-btn" onClick={fetchData}>
            <i className="fa-solid fa-rotate-right"></i> Refresh
          </button>
        </div>

        {/* STAT CARDS */}
        <div className="adm-stats-row">
          <StatCard label="Total Users"    value={students.length}    color="var(--cyber-cyan)"   icon="fa-solid fa-users" />
          <StatCard label="Verified"       value={verified.length}    color="var(--green)"         icon="fa-solid fa-circle-check" />
          <StatCard label="Pending"        value={pending.length}     color="var(--orange)"        icon="fa-solid fa-clock" />
          <StatCard label="Communities"    value={communities.length} color="var(--cyber-yellow)"  icon="fa-solid fa-circle-nodes" />
        </div>

        {/* ── VERIFICATION QUEUE ── */}
        {section === 'verification' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>Pending Enrollments</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pending.length} awaiting review</span>
            </div>
            {loading ? (
              <div className="adm-empty">Loading...</div>
            ) : pending.length === 0 ? (
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
                          <button className="adm-btn approve" onClick={() => approveStudent(s.id)}>
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
              <input
                className="adm-search"
                placeholder="Search by name or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
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
                      <td>
                        <span className={`adm-status ${s.is_verified ? 'verified' : 'pending'}`}>
                          {s.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── COMMUNITIES ── */}
        {section === 'communities' && (
          <div className="adm-card">
            <div className="adm-card-head">
              <span>All Circles</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{communities.length} total</span>
            </div>
            {loading ? <div className="adm-empty">Loading...</div> : communities.length === 0 ? (
              <div className="adm-empty">No communities found.</div>
            ) : (
              <table className="adm-table">
                <thead><tr><th>Name</th><th>Category</th><th>Created By</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {communities.map(c => (
                    <tr key={c.id}>
                      <td style={{ color: 'white', fontWeight: 600 }}>{c.name}</td>
                      <td><span className="adm-tag">{c.category}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.profiles?.full_name || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="adm-btn reject" onClick={() => deleteCommunity(c.id, c.name)}>
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

        {/* ── REPORTS (placeholder) ── */}
        {section === 'reports' && (
          <div className="adm-card">
            <div className="adm-card-head"><span>Reports</span></div>
            <div className="adm-empty">
              <i className="fa-solid fa-flag" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 12, display: 'block' }}></i>
              No reports submitted yet.
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
