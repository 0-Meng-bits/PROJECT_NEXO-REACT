import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function getCategoryIcon(category) {
  const map = {
    academic: 'fa-solid fa-book',
    project:  'fa-solid fa-diagram-project',
    hobby:    'fa-solid fa-gamepad',
    social:   'fa-solid fa-users',
    system:   'fa-solid fa-earth-asia',
  };
  return map[category] || 'fa-solid fa-circle-nodes';
}

function categoryGradient(category) {
  const map = {
    academic: 'linear-gradient(135deg, #1a1a4e, #0d3b6e)',
    project:  'linear-gradient(135deg, #1a3a1a, #0d5c2e)',
    hobby:    'linear-gradient(135deg, #3a1a3a, #6e0d5c)',
    social:   'linear-gradient(135deg, #3a2a0d, #6e4a0d)',
  };
  return map[category] || 'linear-gradient(135deg, #0d1a2e, #0a0f1e)';
}

const GLOBAL_COMM = {
  id: 'global', name: 'Global Feed',
  description: 'Official campus-wide communication node for all CTU students.',
  icon: null, faIcon: 'fa-solid fa-earth-asia', category: 'system', creator_id: 'SYSTEM',
};

function Toast({ message }) {
  return <div className={`toast ${message ? 'show' : ''}`}>{message?.toUpperCase()}</div>;
}

// ── MESSAGE ITEM ──────────────────────────────────────────────────────────────
function MessageItem({ m, tagColor, isOwnerMsg, canDelete, onDelete, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(m.content);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleEdit = async () => {
    if (!editVal.trim() || editVal === m.content) { setEditing(false); return; }
    await onEdit(m.id, editVal.trim());
    setEditing(false);
    setMenuOpen(false);
  };

  const handleUnsend = async () => {
    setMenuOpen(false);
    await onDelete(m.id);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    await onDelete(m.id);
  };

  return (
    <div className="post msg-post">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 4, background: tagColor, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
            {(m.full_name || 'U')[0]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {m.full_name}
              {m.role && <span style={{ fontSize: 9, color: 'var(--cyber-cyan)', marginLeft: 5, border: '1px solid', padding: '1px 4px', borderRadius: 3 }}>{m.role}</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {m.edited && <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>(edited)</span>}
            </div>
          </div>
        </div>

        {/* 3-dot menu — visible on hover */}
        {(isOwnerMsg || canDelete) && (
          <div className="msg-menu-wrap" ref={menuRef}>
            <button className="msg-menu-btn" onClick={() => setMenuOpen(o => !o)}>
              <i className="fa-solid fa-ellipsis"></i>
            </button>
            {menuOpen && (
              <div className="msg-menu-dropdown">
                {isOwnerMsg && (
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }}>
                    <i className="fa-solid fa-pen"></i> Edit
                  </button>
                )}
                {isOwnerMsg && !canDelete && (
                  <button onClick={handleUnsend} style={{ color: 'var(--cyber-yellow)' }}>
                    <i className="fa-solid fa-rotate-left"></i> Unsend
                  </button>
                )}
                {canDelete && (
                  <button onClick={handleDelete} style={{ color: 'var(--red)' }}>
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content or edit input */}
      {editing ? (
        <div style={{ marginLeft: 42, display: 'flex', gap: 8 }}>
          <input
            className="msg-edit-input"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
          <button className="msg-edit-save" onClick={handleEdit}><i className="fa-solid fa-check"></i></button>
          <button className="msg-edit-cancel" onClick={() => setEditing(false)}><i className="fa-solid fa-xmark"></i></button>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginLeft: 42 }}>{m.content}</div>
      )}
    </div>
  );
}

// ── CREATE MODAL ──────────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated, userId }) {
  const [form, setForm] = useState({ name: '', description: '', category: 'academic' });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('communities')
      .insert([{ name: form.name.trim(), description: form.description.trim(), category: form.category, creator_id: userId, is_official: false }])
      .select();
    setLoading(false);
    if (error) { alert('Failed to create node.'); return; }
    onCreated(data[0]);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Create New Circle</h3>
        <div className="input-group">
          <label>CIRCLE NAME</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BSIT 3A Team" />
        </div>
        <div className="input-group">
          <label>CLASSIFICATION</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="academic">Academic / Study Group</option>
            <option value="project">Special Project / Capstone</option>
            <option value="hobby">Hobby / Interest</option>
            <option value="social">Social / Hangout</option>
          </select>
        </div>
        <div className="input-group">
          <label>TRANSMISSION_GOAL</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Briefly describe this node's purpose..." />
        </div>
        <div className="modal-actions">
          <button className="cyber-btn" onClick={submit} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'CREATING...' : 'CREATE_NODE'}
          </button>
          <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>ABORT</button>
        </div>
      </div>
    </div>
  );
}

// rank_level: 0=Member, 1=Moderator, 2=Co-Leader, 3=Leader/Founder
function rankLabel(level) {
  return ['Member', 'Moderator', 'Co-Leader', 'Leader'][level ?? 0] || 'Member';
}
function rankColor(level) {
  if (level >= 3) return 'var(--cyber-yellow)';
  if (level >= 2) return 'var(--cyber-cyan)';
  if (level >= 1) return 'var(--green)';
  return 'var(--text-muted)';
}

// ── MEMBER CARD ───────────────────────────────────────────────────────────────
function MemberCard({ m, onSetRank, onKick, coLeaderCount, moderatorCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const name = m.profiles?.full_name || '—';
  const initials = name !== '—'
    ? name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ranks = [
    { level: 2, label: 'Co-Leader',  capped: coLeaderCount >= 2 },
    { level: 1, label: 'Moderator',  capped: moderatorCount >= 3 },
    { level: 0, label: 'Member',     capped: false },
  ].filter(r => r.level !== m.rank_level);

  return (
    <div className="member-card">
      <div className="member-card-avatar">{initials}</div>
      <div className="member-card-info">
        <div className="member-card-name">{name}</div>
        <div className="member-card-sub">
          <span style={{ color: rankColor(m.rank_level), fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {rankLabel(m.rank_level)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
            {m.profiles?.student_id}
          </span>
        </div>
      </div>
      <div className="member-card-actions" ref={menuRef}>
        <button className="member-card-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          <i className="fa-solid fa-ellipsis-vertical"></i>
        </button>
        {menuOpen && (
          <div className="member-card-dropdown">
            {ranks.map(r => (
              <button
                key={r.level}
                onClick={() => { if (!r.capped) { onSetRank(m.id, r.level); setMenuOpen(false); } }}
                style={{ opacity: r.capped ? 0.4 : 1, cursor: r.capped ? 'not-allowed' : 'pointer' }}
                title={r.capped ? `Cap reached` : ''}
              >
                <i className={`fa-solid ${r.level > m.rank_level ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                Set as {r.label}
                {r.capped && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--red)' }}>FULL</span>}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #222', margin: '4px 0' }}></div>
            <button onClick={() => { onKick(m.id, name); setMenuOpen(false); }} style={{ color: 'var(--red)' }}>
              <i className="fa-solid fa-user-xmark"></i> Kick from Circle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MANAGE GROUP MODAL ────────────────────────────────────────────────────────
function ManageGroupModal({ comm, onClose, onSaved, viewerIsOwner }) {
  const [form, setForm] = useState({ name: comm.name, description: comm.description || '', category: comm.category || 'academic' });
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leader, setLeader] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(viewerIsOwner ? 'settings' : 'members');

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    // fetch leader profile
    const { data: leaderData } = await supabase
      .from('profiles')
      .select('full_name, student_id')
      .eq('id', comm.creator_id)
      .single();
    if (leaderData) setLeader(leaderData);

    const { data } = await supabase
      .from('memberships')
      .select('*, profiles(full_name, student_id)')
      .eq('community_id', comm.id);
    if (data) {
      setMembers(data.filter(m => m.status === 'active'));
      setRequests(data.filter(m => m.status === 'pending'));
    }
    setLoadingMembers(false);
  }, [comm.id, comm.creator_id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const saveSettings = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('communities')
      .update({ name: form.name.trim(), description: form.description.trim(), category: form.category })
      .eq('id', comm.id);
    setSaving(false);
    if (error) { alert('Failed to save.'); return; }
    onSaved({ ...comm, ...form });
    onClose();
  };

  const approveRequest = async (memberId) => {
    const { error } = await supabase.from('memberships')
      .update({ status: 'active' }).eq('id', memberId);
    if (!error) fetchMembers();
  };

  const denyRequest = async (memberId) => {
    const { error } = await supabase.from('memberships')
      .delete().eq('id', memberId);
    if (!error) fetchMembers();
  };

  const kickMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this group?`)) return;
    const { error } = await supabase.from('memberships').delete().eq('id', memberId);
    if (!error) fetchMembers();
  };

  const promoteToCoLeader = async (memberId) => {
    const { error } = await supabase.from('memberships')
      .update({ rank_level: 2 }).eq('id', memberId);
    if (!error) fetchMembers();
  };

  const demoteToMember = async (memberId) => {
    const { error } = await supabase.from('memberships')
      .update({ rank_level: 0 }).eq('id', memberId);
    if (!error) fetchMembers();
  };

  const setRank = async (memberId, level) => {
    // Enforce caps before writing
    if (level === 2 && members.filter(m => m.rank_level === 2).length >= 2) {
      alert('This circle already has 2 Co-Leaders. Demote one first.'); return;
    }
    if (level === 1 && members.filter(m => m.rank_level === 1).length >= 3) {
      alert('This circle already has 3 Moderators. Demote one first.'); return;
    }
    const { error } = await supabase.from('memberships')
      .update({ rank_level: level }).eq('id', memberId);
    if (!error) fetchMembers();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manage-modal-box" onClick={e => e.stopPropagation()}>
        <div className="manage-modal-header">
          <h2><i className="fa-solid fa-gear" style={{ marginRight: 10 }}></i>GROUP SETTINGS</h2>
          <button className="manage-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="manage-tabs">
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              <i className="fa-solid fa-sliders"></i> Settings
            </button>
          )}
          <button className={`manage-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
            <i className="fa-solid fa-users"></i> Members {members.length > 0 && `(${members.length})`}
          </button>
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
              <i className="fa-solid fa-user-clock"></i> Requests
              {requests.length > 0 && <span className="req-badge">{requests.length}</span>}
            </button>
          )}
        </div>

        {tab === 'settings' && (
          <div className="manage-tab-content">
            <div className="input-group">
              <label>CIRCLE NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>CLASSIFICATION</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="academic">Academic / Study Group</option>
                <option value="project">Special Project / Capstone</option>
                <option value="hobby">Hobby / Interest</option>
                <option value="social">Social / Hangout</option>
              </select>
            </div>
            <div className="input-group">
              <label>DESCRIPTION</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this node's purpose..." />
            </div>
            <div className="modal-actions">
              <button className="cyber-btn" onClick={saveSettings} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'SAVING...' : <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }}></i>SAVE CHANGES</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>CANCEL</button>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="manage-tab-content" style={{ padding: 0 }}>
            {/* Leader profile banner */}
            <div className="members-banner">
              <div className="members-banner-avatar">
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--cyber-yellow)' }}>
                  {leader?.full_name
                    ? leader.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                    : '?'}
                </span>
              </div>
              <div className="members-banner-name">{leader?.full_name || '—'}</div>
              <div className="members-banner-handle">
                <span style={{ color: 'var(--cyber-yellow)', fontSize: 11, border: '1px solid var(--cyber-yellow)', padding: '2px 10px', borderRadius: 20 }}>
                  Leader / Founder
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>
                {leader?.student_id}
              </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              {loadingMembers ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading members...</p>
              ) : members.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No active members yet.</p>
              ) : (
                <>
                  {(() => {
                    const coLeaderCount = members.filter(m => m.rank_level === 2).length;
                    const moderatorCount = members.filter(m => m.rank_level === 1).length;
                    return [
                      { label: 'Co-Leaders', filter: m => m.rank_level === 2, cap: 2 },
                      { label: 'Moderators', filter: m => m.rank_level === 1, cap: 3 },
                      { label: 'Members',    filter: m => m.rank_level === 0, cap: null },
                    ].map(({ label, filter, cap }) => {
                      const group = members.filter(filter);
                      if (group.length === 0) return null;
                      return (
                        <div key={label}>
                          <div className="members-section-label">
                            <span>{label}</span>
                            <span style={{ color: cap && group.length >= cap ? 'var(--red)' : 'var(--cyber-cyan)', fontSize: 11 }}>
                              {group.length}{cap ? `/${cap}` : ''}
                            </span>
                          </div>
                          {group.map(m => (
                            <MemberCard
                              key={m.id} m={m}
                              onSetRank={setRank} onKick={kickMember}
                              coLeaderCount={coLeaderCount}
                              moderatorCount={moderatorCount}
                            />
                          ))}
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div className="manage-tab-content">
            {loadingMembers ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading...</p>
            ) : requests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No pending join requests.</p>
            ) : (
              <table className="members-table">
                <thead><tr><th>NAME</th><th>STUDENT ID</th><th>ACTION</th></tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td style={{ color: 'white' }}>{r.profiles?.full_name || '—'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--cyber-cyan)' }}>{r.profiles?.student_id || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="member-action-btn promote" onClick={() => approveRequest(r.id)}><i className="fa-solid fa-check"></i> Approve</button>
                          <button className="member-action-btn kick" onClick={() => denyRequest(r.id)}><i className="fa-solid fa-xmark"></i> Deny</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PROFILE MODAL ─────────────────────────────────────────────────────────────
function ProfileModal({ user, communities, onClose, onLogout }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, border: '2px solid var(--cyber-cyan)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 'bold', margin: '0 auto 15px', color: 'var(--cyber-cyan)' }}>
          {initials}
        </div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{user.full_name?.toUpperCase()}</h2>
        <div className="verified-badge" style={{ margin: '0 auto 20px' }}>
          <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i> Verified Student ✓
        </div>
        <div className="stats-card" style={{ textAlign: 'left', marginBottom: 20 }}>
          <div className="stat-line"><span>STUDENT ID</span><span className="stat-val" style={{ color: 'var(--cyber-yellow)', fontFamily: 'monospace' }}>{user.student_id}</span></div>
          <div className="stat-line"><span>ACTIVE CIRCLES</span><span className="stat-val">{communities.length}</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="cyber-btn danger" onClick={onLogout} style={{ width: '100%' }}>TERMINATE SESSION</button>
          <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PORTAL ───────────────────────────────────────────────────────────────
export default function UserPortal() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const [communities, setCommunities] = useState([GLOBAL_COMM]);
  const [myMemberships, setMyMemberships] = useState([]); // { community_id, role, status }
  const [activeCommId, setActiveCommId] = useState('global');
  const [section, setSection] = useState('home');
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [search, setSearch] = useState('');
  const [clock, setClock] = useState(new Date());
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const toastTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const loadCommunities = useCallback(async () => {
    const { data } = await supabase.from('communities').select('*');
    setCommunities([GLOBAL_COMM, ...(data || [])]);
  }, []);

  const loadChannels = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setChannels([]); setActiveChannelId(null); return; }
    const { data } = await supabase.from('channels').select('*')
      .eq('community_id', commId).order('created_at', { ascending: true });
    const list = data || [];
    setChannels(list);
    setActiveChannelId(prev => list.find(c => c.id === prev) ? prev : (list[0]?.id || null));
  }, []);

  const loadMyMemberships = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('memberships')
      .select('community_id, rank_level, status, id')
      .eq('user_id', user.id);
    setMyMemberships(data || []);
  }, [user?.id]);

  const loadMessages = useCallback(async (commId, channelId) => {
    if (commId === 'global') {
      const { data } = await supabase.from('messages').select('*')
        .is('community_id', null).order('created_at', { ascending: true });
      setMessages(data || []);
    } else if (channelId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('channel_id', channelId).order('created_at', { ascending: true });
      setMessages(data || []);
    } else {
      setMessages([]);
    }
  }, []);

  // Initial load + realtime subscription — re-runs when channel/community changes
  useEffect(() => {
    loadMessages(activeCommId, activeChannelId);

    // Build a unique channel name per context
    const channelName = activeCommId === 'global'
      ? 'realtime:messages:global'
      : `realtime:messages:${activeChannelId || activeCommId}`;

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          // Only add if it belongs to the current view
          const isGlobal = activeCommId === 'global' && !msg.community_id;
          const isChannel = msg.channel_id === activeChannelId;
          if (isGlobal || isChannel) {
            setMessages(prev => {
              // Avoid duplicates (our own sent message is already in state)
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [activeCommId, activeChannelId, loadMessages]);

  useEffect(() => { loadCommunities(); loadMyMemberships(); }, [loadCommunities, loadMyMemberships]);
  useEffect(() => { loadChannels(activeCommId); }, [activeCommId, loadChannels]);

  useEffect(() => { loadCommunities(); loadMyMemberships(); }, [loadCommunities, loadMyMemberships]);
  useEffect(() => { loadChannels(activeCommId); }, [activeCommId, loadChannels]);
  useEffect(() => { loadMessages(activeCommId, activeChannelId); }, [activeCommId, activeChannelId, loadMessages]);
  const initials = user?.full_name
    ? user.full_name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const logout = () => {
    if (confirm('TERMINATE_SESSION?')) { localStorage.removeItem('currentUser'); navigate('/'); }
  };

  // Membership helpers
  const getMembership = (commId) => myMemberships.find(m => m.community_id === commId);
  const isMember = (commId) => {
    if (commId === 'global') return true;
    const comm = communities.find(c => c.id === commId);
    if (comm?.creator_id === user?.id) return true;
    const m = getMembership(commId);
    return m?.status === 'active';
  };
  const isPending = (commId) => getMembership(commId)?.status === 'pending';

  const requestJoin = async (commId) => {
    const { error } = await supabase.from('memberships').insert([{
      community_id: commId, user_id: user.id, rank_level: 0, status: 'pending'
    }]);
    if (!error) { await loadMyMemberships(); showToast('Request sent!'); }
    else showToast('Already requested.');
  };

  const sendPost = async () => {
    if (!msgInput.trim()) return;
    const comm = communities.find(c => c.id === activeCommId);
    const isLeader = comm?.creator_id === user?.id;
    const payload = {
      student_id: user.student_id,
      full_name: user.full_name,
      content: msgInput,
      community_id: activeCommId === 'global' ? null : activeCommId,
      channel_id: activeCommId === 'global' ? null : activeChannelId,
      role: isLeader ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER'),
    };
    const { data, error } = await supabase.from('messages').insert([payload]).select();
    if (!error && data) { setMessages(prev => [...prev, data[0]]); setMsgInput(''); }
  };

  const handleCommCreated = (newComm) => {
    setCommunities(prev => [...prev, newComm]);
    showToast(`Circle created: ${newComm.name}`);
  };

  const deleteCircle = async (id) => {
    if (!confirm('Delete this circle? This cannot be undone.')) return;
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) { showToast('Failed to delete circle.'); return; }
    showToast('Circle deleted.');
    await loadCommunities();
    setActiveCommId('global'); setSection('home');
  };

  const addChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    const { data, error } = await supabase.from('channels')
      .insert([{ community_id: activeCommId, name, created_by: user.id }])
      .select();
    if (!error && data) {
      setChannels(prev => [...prev, data[0]]);
      setActiveChannelId(data[0].id);
      setNewChannelName('');
      setShowAddChannel(false);
    }
  };

  const deleteChannel = async (channelId) => {
    if (!confirm('Delete this channel and all its messages?')) return;
    const { error } = await supabase.from('channels').delete().eq('id', channelId);
    if (!error) {
      const remaining = channels.filter(c => c.id !== channelId);
      setChannels(remaining);
      setActiveChannelId(remaining[0]?.id || null);
    }
  };

  const activeComm = communities.find(c => c.id === activeCommId) || GLOBAL_COMM;
  const isOwner = activeComm.creator_id === user?.id;
  const myRankLevel = getMembership(activeCommId)?.rank_level ?? (isOwner ? 3 : 0);
  const myRole = isOwner ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER');
  const canModerate = isOwner || myRankLevel >= 2; // leader or co-leader
  const tagColor = myRole === 'LEADER' ? 'var(--cyber-yellow)' : myRole === 'CO-LEADER' ? 'var(--cyber-cyan)' : 'var(--text-muted)';

  const deleteMessage = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (!error) setMessages(prev => prev.filter(m => m.id !== msgId));
    else showToast('DELETE_FAILED');
  };

  const editMessage = async (msgId, newContent) => {
    const { error } = await supabase.from('messages')
      .update({ content: newContent, edited: true }).eq('id', msgId);
    if (!error) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, edited: true } : m));
    else showToast('EDIT_FAILED');
  };

  // Joined circles for dock (only active memberships + owned)
  const myCircles = communities.filter(c =>
    c.id === 'global' || c.creator_id === user?.id || isMember(c.id)
  );

  return (
    <div className="portal-layout">
      {/* TOP NAV */}
      <nav className="top-nav-bar">
        {/* LEFT — date & time */}
        <div className="nav-clock">
          <span className="nav-clock-time">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="nav-clock-date">
            {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* CENTER — search */}
        <div className="nav-search-wrap">
          <i className="fa-solid fa-magnifying-glass nav-search-icon"></i>
          <input
            className="nav-search-input"
            placeholder="Search communities or users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="nav-search-clear" onClick={() => setSearch('')}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          {/* Dropdown results */}
          {search.trim() && (
            <div className="nav-search-results">
              {/* Communities */}
              {communities.filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                <>
                  <div className="search-result-label">COMMUNITIES</div>
                  {communities
                    .filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 4)
                    .map(c => (
                      <div key={c.id} className="search-result-item" onClick={() => {
                        setActiveCommId(c.id); setSection('circles'); setSearch('');
                      }}>
                        <i className={getCategoryIcon(c.category)} style={{ color: 'var(--cyber-cyan)', marginRight: 10 }}></i>
                        <div>
                          <div style={{ fontSize: 13, color: 'white' }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{c.category}</div>
                        </div>
                      </div>
                    ))
                  }
                </>
              )}
              {/* No results */}
              {communities.filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>No results found.</div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — user hud */}
        <div className="user-hud">
          <div className="hud-chip">
            <span className="hud-label">USER_ID:</span>
            <span className="hud-value">{user?.student_id}</span>
          </div>
          <div className="hud-avatar" onClick={() => setShowProfile(true)}>{initials}</div>
        </div>
      </nav>

      <div className="main">
        {/* CIRCLE DOCK — only joined circles */}
        <div className="circle-dock">
          <div className="dock-branding">
            <img src="/logoo.png" className="brand-logo-small" alt="NEXO" />
          </div>
          {myCircles.map(c => (
            <div key={c.id} className={`dock-icon ${activeCommId === c.id ? 'active' : ''}`}
              title={c.name} onClick={() => {
                setActiveCommId(c.id);
                setSection(c.id === 'global' ? 'home' : 'circles');
              }}>
              <i className={c.faIcon || getCategoryIcon(c.category)}></i>
            </div>
          ))}
          <div className="dock-add-btn" title="Create Node" onClick={() => setShowCreate(true)}>+</div>
        </div>

        {/* SIDEBAR — context aware */}
        <div className="sidebar">
          {activeCommId === 'global' ? (
            /* ── GLOBAL / HOME sidebar ── */
            <>
              <div className="sidebar-brand-area">
                <h2 className="sidebar-title">NEXO <span className="cyan-text">CONNECT</span></h2>
              </div>
              <div className="sidebar-label">MAIN</div>
              <div className="nav-links">
                <div className={`ls-item ${section === 'home' ? 'active' : ''}`} onClick={() => setSection('home')}>
                  <i className="nav-icon fa-solid fa-house-chimney"></i>
                  <span className="node-name">Home Feed</span>
                </div>
                <div className={`ls-item ${section === 'activity' && activeCategory === 'all' ? 'active' : ''}`} onClick={() => { setSection('activity'); setActiveCategory('all'); }}>
                  <i className="nav-icon fa-solid fa-compass"></i>
                  <span className="node-name">Explore</span>
                </div>
              </div>
              <div className="sidebar-label" style={{ marginTop: 12 }}>CATEGORIES</div>
              <div className="nav-links">
                {[
                  { key: 'academic', label: 'Academic',  icon: 'fa-solid fa-book' },
                  { key: 'project',  label: 'Projects',  icon: 'fa-solid fa-diagram-project' },
                  { key: 'hobby',    label: 'Hobbies',   icon: 'fa-solid fa-gamepad' },
                  { key: 'social',   label: 'Social',    icon: 'fa-solid fa-users' },
                ].map(cat => (
                  <div key={cat.key}
                    className={`ls-item ${section === 'activity' && activeCategory === cat.key ? 'active' : ''}`}
                    onClick={() => { setSection('activity'); setActiveCategory(cat.key); }}
                  >
                    <i className={`nav-icon ${cat.icon}`}></i>
                    <span className="node-name">{cat.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── CIRCLE sidebar ── */
            <>
              <div className="sidebar-brand-area" style={{ paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    <i className={activeComm.faIcon || getCategoryIcon(activeComm.category)} style={{ color: 'var(--cyber-cyan)' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: 1 }}>{activeComm.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{activeComm.category || 'circle'}</div>
                  </div>
                </div>
              </div>

              <div className="sidebar-label">CHANNELS</div>
              <div className="nav-links">
                {channels.length === 0 && (
                  <div style={{ padding: '8px 15px', fontSize: 12, color: 'var(--text-muted)' }}>
                    No channels yet.
                  </div>
                )}
                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className={`ls-item ${activeChannelId === ch.id ? 'active' : ''}`}
                    onClick={() => { setActiveChannelId(ch.id); setSection('circles'); }}
                  >
                    <i className="channel-hash">#</i>
                    <span className="node-name">{ch.name}</span>
                    {canModerate && (
                      <i
                        className="fa-solid fa-xmark channel-delete-btn"
                        onClick={e => { e.stopPropagation(); deleteChannel(ch.id); }}
                        title="Delete channel"
                      ></i>
                    )}
                  </div>
                ))}

                {/* Add channel — leaders/co-leaders only */}
                {canModerate && (
                  showAddChannel ? (
                    <div style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
                      <input
                        className="channel-name-input"
                        value={newChannelName}
                        onChange={e => setNewChannelName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addChannel(); if (e.key === 'Escape') setShowAddChannel(false); }}
                        placeholder="channel-name"
                        autoFocus
                      />
                      <button className="channel-confirm-btn" onClick={addChannel}>
                        <i className="fa-solid fa-check"></i>
                      </button>
                      <button className="channel-cancel-btn" onClick={() => setShowAddChannel(false)}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="ls-item add-channel-btn" onClick={() => setShowAddChannel(true)}>
                      <i className="channel-hash" style={{ color: 'var(--text-muted)' }}>+</i>
                      <span className="node-name" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Add Channel</span>
                    </div>
                  )
                )}
              </div>

              {/* Moderators can see members but not settings/delete */}
              {canModerate && (
                <>
                  <div className="sidebar-label" style={{ marginTop: 12 }}>MANAGE</div>
                  <div className="nav-links">
                    {isOwner && (
                      <>
                        <div className="ls-item" onClick={() => setShowManage(true)}>
                          <i className="nav-icon fa-solid fa-gear"></i>
                          <span className="node-name">Settings</span>
                        </div>
                        <div className="ls-item" style={{ color: 'var(--red)' }} onClick={() => deleteCircle(activeComm.id)}>
                          <i className="nav-icon fa-solid fa-circle-xmark"></i>
                          <span className="node-name">Delete Circle</span>
                        </div>
                      </>
                    )}
                    {!isOwner && (
                      <div className="ls-item" onClick={() => setShowManage(true)}>
                        <i className="nav-icon fa-solid fa-users"></i>
                        <span className="node-name">View Members</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid rgba(0,240,255,0.08)' }}>
                <div className="ls-item" onClick={() => { setActiveCommId('global'); setSection('home'); }}>
                  <i className="nav-icon fa-solid fa-arrow-left"></i>
                  <span className="node-name">Back to Home</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* CONTENT */}
        <div className="content">

          {/* ── HOME ── */}
          {section === 'home' && (
            <div className="c-feed fade-in">

              {/* Hero banner */}
              <div className="home-hero">
                <div className="home-hero-text">
                  <h1>Find Your Circle<br/>at CTU</h1>
                  <p>Discover communities built around your interests, join the conversation, and make your campus experience count.</p>
                  <button className="cyber-btn" style={{ width: 'auto', padding: '10px 24px', marginTop: 16 }}
                    onClick={() => { setSection('activity'); setActiveCategory('all'); }}>
                    <i className="fa-solid fa-compass" style={{ marginRight: 8 }}></i>Explore Circles
                  </button>
                </div>
              </div>

              {/* Welcome + stats — kept from before */}
              <div className="welcome-grid">
                <div className="post" style={{ borderLeft: '4px solid var(--cyber-yellow)' }}>
                  <h2 style={{ fontSize: 18, letterSpacing: 2, color: 'var(--cyber-yellow)' }}>
                    WELCOME, {user?.full_name?.toUpperCase() || 'TECHNOLOGIST'}!
                  </h2>
                  <div className="verified-badge">
                    <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i> Verified Technologist ✓
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 15 }}>
                    Monitoring real-time network activity across all CTU circles.
                  </p>
                </div>
                <div className="stats-card">
                  <h4 style={{ fontSize: 11, color: 'var(--cyber-yellow)', marginBottom: 15, letterSpacing: 2 }}>QUICK_STATS</h4>
                  <div className="stat-line">My Circles <span className="stat-val">{myCircles.length}</span></div>
                  <div className="stat-line">Network Status <span className="stat-val" style={{ color: '#00ff00' }}>ONLINE</span></div>
                  <div className="stat-line">Clearance <span className="stat-val">{user?.user_type?.toUpperCase()}</span></div>
                </div>
              </div>

              {/* Featured Communities */}
              <div className="home-section-header">
                <span>Featured Circles</span>
                <span className="home-see-all" onClick={() => { setSection('activity'); setActiveCategory('all'); }}>See all</span>
              </div>
              <div className="featured-grid">
                {communities.filter(c => c.id !== 'global').slice(0, 4).map(c => (
                  <div key={c.id} className="featured-card"
                    onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                    <div className="featured-card-bg" style={{ background: categoryGradient(c.category) }}></div>
                    <div className="featured-card-body">
                      <div className="featured-card-icon">
                        <i className={getCategoryIcon(c.category)}></i>
                      </div>
                      <div className="featured-card-name">{c.name}</div>
                      <div className="featured-card-desc">{c.description || 'No description provided.'}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Popular by category */}
              <div className="home-section-header" style={{ marginTop: 8 }}>
                <span>Popular Right Now</span>
                <span className="home-see-all" onClick={() => { setSection('activity'); setActiveCategory('all'); }}>See all</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {communities.filter(c => c.id !== 'global').slice(0, 3).map(c => (
                  <div key={c.id} className="popular-row"
                    onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                    <div className="popular-row-icon" style={{ background: categoryGradient(c.category) }}>
                      <i className={getCategoryIcon(c.category)}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{c.category}</div>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }}></i>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ── ACTIVITY HUB — discover & join circles ── */}
          {section === 'activity' && (
            <div className="c-feed fade-in">
              <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)', marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)' }}>
                  <i className="fa-solid fa-compass" style={{ marginRight: 10 }}></i>
                  {activeCategory === 'all' ? 'EXPLORE ALL CIRCLES' : activeCategory.toUpperCase()}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                  Discover circles and request to join. Click a category in the sidebar to filter.
                </p>
              </div>

              {(() => {
                const filtered = communities.filter(c =>
                  c.id !== 'global' && (activeCategory === 'all' || c.category === activeCategory)
                );
                return filtered.length === 0 ? (
                  <div className="post"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No circles found in this category.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(c => {
                      const owned = c.creator_id === user?.id;
                      const joined = isMember(c.id);
                      const pending = isPending(c.id);
                      return (
                        <div key={c.id} className="post" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <i className={getCategoryIcon(c.category)} style={{ color: 'var(--cyber-cyan)', fontSize: 16 }}></i>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid #333', padding: '2px 6px', borderRadius: 4 }}>{c.category}</span>
                            {owned && <span style={{ fontSize: 10, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '2px 6px', borderRadius: 4 }}>YOUR NODE</span>}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.description || 'No description provided.'}</p>
                        </div>
                        <div style={{ flexShrink: 0, marginLeft: 20 }}>
                          {owned || joined ? (
                            <button className="group-action-btn manage"
                              onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                              <i className="fa-solid fa-arrow-right-to-bracket"></i> ENTER
                            </button>
                          ) : pending ? (
                            <span style={{ fontSize: 11, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: 5 }}></i>PENDING
                            </span>
                          ) : (
                            <button className="group-action-btn manage" onClick={() => requestJoin(c.id)}>
                              <i className="fa-solid fa-paper-plane"></i> REQUEST
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── MY CIRCLES / CIRCLE FEED ── */}
          {section === 'circles' && (
            <>
              <div className="c-feed fade-in">
                <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)' }}>
                  <h2 style={{ fontSize: 20, letterSpacing: 1 }}>
                    {activeComm.name.toUpperCase()}
                    {activeChannelId && channels.find(c => c.id === activeChannelId) && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 16, marginLeft: 10 }}>
                        # {channels.find(c => c.id === activeChannelId)?.name}
                      </span>
                    )}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    <div className="verified-badge">
                      GROUP: {(activeComm.category || 'General').toUpperCase()} | ROLE: {myRole}
                    </div>
                  </div>
                  <p style={{ marginTop: 15, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                    {activeComm.description || 'No description provided.'}
                  </p>
                </div>

                {/* Access gate for non-members */}
                {!isMember(activeCommId) ? (
                  <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }}></i>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>This node requires membership to access transmissions.</p>
                    {isPending(activeCommId) ? (
                      <span style={{ color: 'var(--cyber-yellow)', fontSize: 12 }}>
                        <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i>Join request pending approval...
                      </span>
                    ) : (
                      <button className="group-action-btn manage" onClick={() => requestJoin(activeCommId)}>
                        <i className="fa-solid fa-paper-plane"></i> REQUEST TO JOIN
                      </button>
                    )}
                  </div>
                ) : (
                  messages.map(m => {
                    const isOwnerMsg = m.student_id === user?.student_id;
                    const canDelete = isOwnerMsg || canModerate;
                    return (
                      <MessageItem
                        key={m.id}
                        m={m}
                        tagColor={tagColor}
                        isOwnerMsg={isOwnerMsg}
                        canDelete={canDelete}
                        onDelete={deleteMessage}
                        onEdit={editMessage}
                      />
                    );
                  })
                )}
              </div>

              {isMember(activeCommId) && (
                <div className="composer">
                  <div className="c-input-wrap">
                    <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendPost()} placeholder="Write a message..." />
                    <button className="cyber-btn" onClick={sendPost}>SEND</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showManage && (
        <ManageGroupModal comm={activeComm} onClose={() => setShowManage(false)}
          viewerIsOwner={isOwner}
          onSaved={(updated) => {
            setCommunities(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            showToast('SETTINGS_SAVED');
          }}
        />
      )}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCommCreated} userId={user?.id} />}
      {showProfile && <ProfileModal user={user} communities={myCircles} onClose={() => setShowProfile(false)} onLogout={logout} />}
      <Toast message={toast} />
    </div>
  );
}


