import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuditionFormBuilder, AuditionReviewPanel, AuditionApplicationForm, auditionStatusLabel, auditionStatusColor } from './AuditionSystem';
import ThemePicker from './ThemePicker';
import { loadTheme } from '../lib/theme';

function getCategoryIcon(category) {
  const map = {
    academic: 'fa-solid fa-graduation-cap',
    project:  'fa-solid fa-flask',
    hobby:    'fa-solid fa-gamepad',
    social:   'fa-solid fa-user-group',
    system:   'fa-solid fa-earth-asia',
  };
  return map[category] || 'fa-solid fa-network-wired';
}

function notifIcon(type) {
  const map = {
    join_approved:    'fa-solid fa-circle-check',
    join_denied:      'fa-solid fa-circle-xmark',
    kicked:           'fa-solid fa-user-xmark',
    promoted:         'fa-solid fa-arrow-up',
    audition_update:  'fa-solid fa-microphone',
    new_announcement: 'fa-solid fa-bullhorn',
  };
  return map[type] || 'fa-solid fa-bell';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
  id: 'global', name: 'NEXO Hub',
  description: 'The central gathering space for all CTU students and faculty.',
  icon: null, faIcon: 'fa-solid fa-earth-asia', category: 'system', creator_id: 'SYSTEM',
};

function Toast({ message }) {
  return <div className={`toast ${message ? 'show' : ''}`}>{message?.toUpperCase()}</div>;
}

// ── POST TYPE CONFIG ──────────────────────────────────────────────────────────
const POST_TYPE = {
  announcement: { label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
  event:        { label: 'Event',         color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
  shoutout:     { label: 'Shoutout',      color: 'var(--green)',        icon: 'fa-solid fa-star' },
  general:      { label: 'General',       color: 'var(--text-muted)',   icon: 'fa-solid fa-comment' },
};

function AnnouncementCard({ a, user, onPin, onDelete }) {
  const type = POST_TYPE[a.post_type] || POST_TYPE.general;
  const isAnon = a.author_name === 'Anonymous';
  const displayName = isAnon ? 'Anonymous' : a.author_name;
  const avatarChar = isAnon ? '?' : (a.author_name || 'A')[0].toUpperCase();

  return (
    <div className={`announcement-card ${a.pinned ? 'pinned' : ''}`}>
      {a.pinned && (
        <div className="announcement-pin-badge">
          <i className="fa-solid fa-thumbtack"></i> Pinned
        </div>
      )}
      <div className="announcement-header">
        <div className={`announcement-author-avatar ${isAnon ? 'anon' : ''}`}>
          {isAnon ? <i className="fa-solid fa-user-secret"></i> : avatarChar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: isAnon ? 'var(--text-muted)' : 'white' }}>
              {displayName}
            </span>
            {isAnon && (
              <span style={{ fontSize: 10, color: '#666', border: '1px solid #333', padding: '1px 7px', borderRadius: 10, fontStyle: 'italic' }}>
                anonymous
              </span>
            )}
            <span style={{ fontSize: 10, color: type.color, border: `1px solid ${type.color}`, padding: '1px 7px', borderRadius: 10 }}>
              <i className={type.icon} style={{ marginRight: 4 }}></i>{type.label}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {isAnon ? 'Anonymous' : a.author_type} · {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        {/* Own post: author_id matches. Anon posts: only admin can delete */}
        {(user?.user_type === 'Admin' || (!isAnon && a.author_id === user?.id) || (isAnon && a.author_id === user?.id)) && (
          <div style={{ display: 'flex', gap: 6 }}>
            {user?.user_type === 'Admin' && (
              <button className="chat-action-btn" onClick={() => onPin(a.id, a.pinned)}
                style={{ color: 'var(--cyber-yellow)' }} title={a.pinned ? 'Unpin' : 'Pin'}>
                <i className="fa-solid fa-thumbtack"></i>
              </button>
            )}
            <button className="chat-action-btn" onClick={() => onDelete(a.id)} style={{ color: 'var(--red)' }}>
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        )}
      </div>
      <h3 className="announcement-title">{a.title}</h3>
      <p className="announcement-body">{a.content}</p>
    </div>
  );
}

// ── MESSAGE ITEM ──────────────────────────────────────────────────────────────
const REACTIONS = [
  { type: 'heart', emoji: '❤️' },
  { type: 'laugh', emoji: '😂' },
  { type: 'sad',   emoji: '😢' },
];

function MessageItem({ m, tagColor, isOwnerMsg, canDelete, onDelete, onEdit, onViewProfile, currentStudentId }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(m.content);
  const [hovered, setHovered] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [reactions, setReactions] = useState({});
  const reactPickerRef = useRef(null);

  // Load reactions
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('reaction, student_id')
        .eq('message_id', m.id);
      if (cancelled || error || !data) return;
      const grouped = {};
      data.forEach(r => {
        if (!grouped[r.reaction]) grouped[r.reaction] = [];
        grouped[r.reaction].push(r.student_id);
      });
      setReactions(grouped);
    };
    load();
    const sub = supabase.channel(`reactions:${m.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `message_id=eq.${m.id}` },
        () => { if (!cancelled) load(); }
      ).subscribe();
    return () => { cancelled = true; supabase.removeChannel(sub); };
  }, [m.id]);

  useEffect(() => {
    const handler = (e) => {
      if (reactPickerRef.current && !reactPickerRef.current.contains(e.target)) {
        setShowReactPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleReaction = async (type) => {
    setShowReactPicker(false);
    const alreadyReacted = reactions[type]?.includes(currentStudentId);

    // Optimistic update — show immediately
    setReactions(prev => {
      const current = prev[type] || [];
      return {
        ...prev,
        [type]: alreadyReacted
          ? current.filter(s => s !== currentStudentId)
          : [...current, currentStudentId],
      };
    });

    if (alreadyReacted) {
      await supabase.from('message_reactions')
        .delete()
        .eq('message_id', m.id)
        .eq('student_id', currentStudentId)
        .eq('reaction', type);
    } else {
      await supabase.from('message_reactions').insert([{
        message_id: m.id,
        student_id: currentStudentId,
        reaction: type,
      }]);
    }
  };

  const handleEdit = async () => {
    if (!editVal.trim() || editVal === m.content) { setEditing(false); return; }
    await onEdit(m.id, editVal.trim());
    setEditing(false);
  };

  const initials = (m.full_name || 'U')[0].toUpperCase();
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasReactions = REACTIONS.some(r => (reactions[r.type]?.length || 0) > 0);

  return (
    <div className={`chat-row ${isOwnerMsg ? 'own' : 'other'}`}>
      {!isOwnerMsg && (
        <div className="chat-avatar" style={{ background: tagColor, cursor: 'pointer' }}
          onClick={() => onViewProfile?.(m.student_id)}>{initials}</div>
      )}

      <div className="chat-body"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { if (!showReactPicker) setHovered(false); }}
        style={{ paddingBottom: hasReactions ? 4 : 14 }}
      >
        {!isOwnerMsg && (
          <div className="chat-meta">
            <span className="chat-name">{m.full_name}</span>
            {m.role && <span className="chat-role">{m.role}</span>}
            <span className="chat-time">{time}</span>
          </div>
        )}

        {/* Bubble row — bubble first, then action buttons to the RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>

          {/* Bubble always first in DOM */}
          {editing ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="msg-edit-input" value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
                autoFocus />
              <button className="msg-edit-save" onClick={handleEdit}><i className="fa-solid fa-check" /></button>
              <button className="msg-edit-cancel" onClick={() => setEditing(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
          ) : (
            <div className={`chat-bubble ${isOwnerMsg ? 'own' : 'other'}`}>
              {m.content}
            </div>
          )}

          {/* Action buttons always to the RIGHT of the bubble */}
          {hovered && !editing && (
            <div className="bubble-actions" ref={reactPickerRef}>
              <div style={{ position: 'relative' }}>
                <button className="chat-action-btn" onClick={() => setShowReactPicker(o => !o)} title="React">
                  <i className="fa-regular fa-face-smile" />
                </button>
                {showReactPicker && (
                  <div className="react-picker other">
                    {REACTIONS.map(r => {
                      const mine = reactions[r.type]?.includes(currentStudentId);
                      return (
                        <button key={r.type} className={`react-option ${mine ? 'active' : ''}`}
                          onClick={() => toggleReaction(r.type)}>{r.emoji}</button>
                      );
                    })}
                  </div>
                )}
              </div>
              {isOwnerMsg && (
                <button className="chat-action-btn" onClick={() => setEditing(true)} title="Edit">
                  <i className="fa-solid fa-pen" />
                </button>
              )}
              {isOwnerMsg && !canDelete && (
                <button className="chat-action-btn" onClick={() => onDelete(m.id)} title="Unsend"
                  style={{ color: 'var(--cyber-yellow)' }}>
                  <i className="fa-solid fa-rotate-left" />
                </button>
              )}
              {canDelete && (
                <button className="chat-action-btn" onClick={() => onDelete(m.id)} title="Delete"
                  style={{ color: 'var(--red)' }}>
                  <i className="fa-solid fa-trash-can" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reaction chips below bubble */}
        {hasReactions && (
          <div className="reaction-bar">
            {REACTIONS.map(r => {
              const count = reactions[r.type]?.length || 0;
              if (!count) return null;
              const mine = reactions[r.type]?.includes(currentStudentId);
              return (
                <button key={r.type} className={`reaction-chip ${mine ? 'mine' : ''}`}
                  onClick={() => toggleReaction(r.type)} title={`${count} ${r.type}`}>
                  {r.emoji} <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {isOwnerMsg && !editing && (
          <div className="chat-meta own">
            {m.edited && <span style={{ fontStyle: 'italic' }}>edited</span>}
            <span className="chat-time">{time}</span>
          </div>
        )}
      </div>

      {isOwnerMsg && (
        <div className="chat-avatar own" style={{ background: tagColor }}>{initials}</div>
      )}
    </div>
  );
}

// Icon options per category
const CATEGORY_ICONS = {
  academic: [
    { icon: 'fa-solid fa-graduation-cap', label: 'Graduation' },
    { icon: 'fa-solid fa-book-open',      label: 'Book' },
    { icon: 'fa-solid fa-flask',          label: 'Science' },
    { icon: 'fa-solid fa-chalkboard',     label: 'Chalkboard' },
  ],
  project: [
    { icon: 'fa-solid fa-diagram-project', label: 'Diagram' },
    { icon: 'fa-solid fa-code',            label: 'Code' },
    { icon: 'fa-solid fa-rocket',          label: 'Rocket' },
    { icon: 'fa-solid fa-lightbulb',       label: 'Idea' },
  ],
  hobby: [
    { icon: 'fa-solid fa-gamepad',         label: 'Gaming' },
    { icon: 'fa-solid fa-music',           label: 'Music' },
    { icon: 'fa-solid fa-palette',         label: 'Art' },
    { icon: 'fa-solid fa-camera',          label: 'Photo' },
  ],
  social: [
    { icon: 'fa-solid fa-user-group',      label: 'Group' },
    { icon: 'fa-solid fa-heart',           label: 'Heart' },
    { icon: 'fa-solid fa-star',            label: 'Star' },
    { icon: 'fa-solid fa-fire',            label: 'Fire' },
  ],
};

// ── CREATE MODAL ──────────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated, userId }) {
  const [form, setForm] = useState({ name: '', description: '', category: 'academic', icon: 'fa-solid fa-graduation-cap' });
  const [loading, setLoading] = useState(false);

  const handleCategoryChange = (cat) => {
    // Auto-select first icon of new category
    const firstIcon = CATEGORY_ICONS[cat]?.[0]?.icon || 'fa-solid fa-graduation-cap';
    setForm(f => ({ ...f, category: cat, icon: firstIcon }));
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('communities')
      .insert([{ name: form.name.trim(), description: form.description.trim(), category: form.category, icon: form.icon, creator_id: userId, is_official: false }])
      .select();
    setLoading(false);
    if (error) { alert('Failed to create circle.'); return; }
    onCreated(data[0]);
    onClose();
  };

  const icons = CATEGORY_ICONS[form.category] || [];

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
          <select value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
            <option value="academic">Academic / Study Group</option>
            <option value="project">Special Project / Capstone</option>
            <option value="hobby">Hobby / Interest</option>
            <option value="social">Social / Hangout</option>
          </select>
        </div>

        {/* Icon picker */}
        <div className="input-group">
          <label>CIRCLE ICON</label>
          <div className="icon-picker">
            {icons.map(opt => (
              <button
                key={opt.icon}
                type="button"
                className={`icon-pick-btn ${form.icon === opt.icon ? 'selected' : ''}`}
                onClick={() => setForm(f => ({ ...f, icon: opt.icon }))}
                title={opt.label}
              >
                <i className={opt.icon}></i>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="input-group">
          <label>DESCRIPTION</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Briefly describe this circle's purpose..." />
        </div>
        <div className="modal-actions">
          <button className="cyber-btn" onClick={submit} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'CREATING...' : 'CREATE CIRCLE'}
          </button>
          <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>CANCEL</button>
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
    const member = requests.find(r => r.id === memberId);
    const { error } = await supabase.from('memberships')
      .update({ status: 'active' }).eq('id', memberId);
    if (!error) {
      // Send notification to the applicant
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'join_approved',
          message: `Your request to join "${comm.name}" has been approved!`,
          link_comm_id: comm.id,
        }]);
      }
      fetchMembers();
    }
  };

  const denyRequest = async (memberId) => {
    const member = requests.find(r => r.id === memberId);
    const { error } = await supabase.from('memberships').delete().eq('id', memberId);
    if (!error) {
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'join_denied',
          message: `Your request to join "${comm.name}" was not approved.`,
          link_comm_id: comm.id,
        }]);
      }
      fetchMembers();
    }
  };

  const kickMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this group?`)) return;
    const member = members.find(m => m.id === memberId);
    const { error } = await supabase.from('memberships').delete().eq('id', memberId);
    if (!error) {
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'kicked',
          message: `You have been removed from "${comm.name}".`,
        }]);
      }
      fetchMembers();
    }
  };

  const setRank = async (memberId, level) => {
    if (level === 2 && members.filter(m => m.rank_level === 2).length >= 2) {
      alert('This circle already has 2 Co-Leaders. Demote one first.'); return;
    }
    if (level === 1 && members.filter(m => m.rank_level === 1).length >= 3) {
      alert('This circle already has 3 Moderators. Demote one first.'); return;
    }
    const member = members.find(m => m.id === memberId);
    const { error } = await supabase.from('memberships')
      .update({ rank_level: level }).eq('id', memberId);
    if (!error) {
      if (member?.user_id && level > (member.rank_level ?? 0)) {
        const labels = ['Member', 'Moderator', 'Co-Leader'];
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'promoted',
          message: `You've been promoted to ${labels[level]} in "${comm.name}"!`,
          link_comm_id: comm.id,
        }]);
      }
      fetchMembers();
    }
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
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'audition' ? 'active' : ''}`} onClick={() => setTab('audition')}>
              <i className="fa-solid fa-microphone"></i> Audition
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

        {tab === 'audition' && viewerIsOwner && (
          <div className="manage-tab-content">
            <AuditionFormBuilder
              comm={comm}
              onToggle={(enabled) => onSaved({ ...comm, audition_enabled: enabled })}
            />
            {comm.audition_enabled && (
              <>
                <div className="audition-section-label" style={{ marginTop: 24 }}>
                  <span>Applications Received</span>
                </div>
                <AuditionReviewPanel comm={comm} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── INTEREST LABELS (shared) ─────────────────────────────────────────────────
const INTEREST_LABELS = {
  coding: '💻 Coding', design: '🎨 Design', gaming: '🎮 Gaming',
  music: '🎵 Music', sports: '⚽ Sports', research: '🔬 Research',
  art: '🖼️ Art', photography: '📷 Photography', writing: '✍️ Writing',
  robotics: '🤖 Robotics', business: '💼 Business', cooking: '🍳 Cooking',
  travel: '✈️ Travel', anime: '🌸 Anime', fitness: '💪 Fitness',
  debate: '🗣️ Debate', reading: '📚 Reading', podcasting: '🎙️ Podcasting',
  language_learning: '🌐 Language Learning', bl_gl: '🏳️‍🌈 Watching BL/GL',
  esports: '🏆 E-Sports', dancing: '💃 Dancing',
};

const INTEREST_BUBBLES = Object.entries(INTEREST_LABELS).map(([id, label]) => ({ id, label }));

const COURSES = ['BEED','BIT AUTO TECH','BIT COM TECH','BIT ELEC TECH','BSED MATH','BSFI','BSHM','BSIE','BSIT','BTLED-HE'];
const YEAR_LEVELS = ['1st', '2nd', '3rd', '4th', 'Graduate'];

// ── VIEW PROFILE MODAL (other users) ─────────────────────────────────────────
function ViewProfileModal({ studentId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, student_id, user_type, is_verified, avatar_url, course, year_level, interests')
        .eq('student_id', studentId)
        .single();
      setProfile(data);
      setLoading(false);
    };
    fetch_();
  }, [studentId]);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 360 }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block' }} />
            LOADING...
          </div>
        ) : !profile ? (
          <p style={{ color: 'var(--text-muted)', padding: 32 }}>Profile not found.</p>
        ) : (
          <>
            {/* Avatar */}
            <div style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid var(--cyber-cyan)', margin: '0 auto 14px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 'bold', color: 'var(--cyber-cyan)', background: 'rgba(0,240,255,0.05)' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>{profile.full_name?.toUpperCase()}</h2>
            {profile.is_verified ? (
              <div className="verified-badge" style={{ margin: '0 auto 16px' }}>
                <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }} /> Verified {profile.user_type} ✓
              </div>
            ) : (
              <div className="verified-badge" style={{ margin: '0 auto 16px', borderColor: 'var(--orange)', color: 'var(--orange)', background: 'rgba(247,169,79,0.05)' }}>
                <i className="fa-solid fa-clock" style={{ marginRight: 6 }} /> Pending Verification
              </div>
            )}
            <div className="stats-card" style={{ textAlign: 'left', marginBottom: 16 }}>
              <div className="stat-line"><span>STUDENT ID</span><span className="stat-val" style={{ color: 'var(--cyber-yellow)', fontFamily: 'monospace' }}>{profile.student_id}</span></div>
              {profile.course && <div className="stat-line"><span>COURSE</span><span className="stat-val">{profile.course}</span></div>}
              {profile.year_level && <div className="stat-line"><span>YEAR</span><span className="stat-val">{profile.year_level}</span></div>}
            </div>
            {profile.interests?.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>INTERESTS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {profile.interests.map(id => (
                    <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', color: 'var(--cyber-cyan)' }}>
                      {INTEREST_LABELS[id] || id}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>CLOSE</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── PROFILE MODAL ─────────────────────────────────────────────────────────────
function ProfileModal({ user, communities, onClose, onLogout, onAvatarUpdate, currentAvatarUrl, onProfileUpdate, showToast }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || user.avatar_url || null);
  const fileInputRef = useRef(null);
  const idPhotoRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [idUploaded, setIdUploaded] = useState(!!user.id_photo_url);
  // Fresh profile data fetched from DB on open
  const [profile, setProfile] = useState({
    course: user.course || '',
    year_level: user.year_level || '',
    interests: user.interests || [],
  });

  // Fetch latest profile data from DB when modal opens
  useEffect(() => {
    if (!user?.id) return;

    // Try to get fresh data directly from Supabase using the user's session
    const fetchProfile = async () => {
      try {
        // First try: use the stored session token to authenticate the request
        const token = localStorage.getItem('accessToken');

        // Direct Supabase query — works if RLS allows users to read own profile
        const { data, error } = await supabase
          .from('profiles')
          .select('course, year_level, interests, avatar_url, id_photo_url')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setProfile({
            course: data.course || '',
            year_level: data.year_level || '',
            interests: data.interests || [],
          });
          if (data.avatar_url && !avatarUrl) setAvatarUrl(data.avatar_url);
          if (data.id_photo_url) setIdUploaded(true);
          const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
          localStorage.setItem('currentUser', JSON.stringify({ ...stored, ...data }));
          return;
        }

        // Fallback: try /api/get-profile
        const headers = { 'Content-Type': 'application/json' };
        const res = await fetch(`/api/me?userId=${user.id}`, { headers });
        if (res.ok) {
          const result = await res.json();
          if (result?.user) {
            setProfile({
              course: result.user.course || '',
              year_level: result.user.year_level || '',
              interests: result.user.interests || [],
            });
            if (result.user.avatar_url && !avatarUrl) setAvatarUrl(result.user.avatar_url);
            if (result.user.id_photo_url) setIdUploaded(true);
            const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
            localStorage.setItem('currentUser', JSON.stringify({ ...stored, ...result.user }));
          }
        }
      } catch (err) {
        console.error('[ProfileModal] fetch error:', err);
        // Last resort: use localStorage
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        setProfile({
          course: stored.course || '',
          year_level: stored.year_level || '',
          interests: stored.interests || [],
        });
        if (stored.id_photo_url) setIdUploaded(true);
      }
    };

    fetchProfile();
  }, [user.id]);

  const handleIdPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIdUploading(true);
    try {
      // Compress to max 800px wide
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          const MAX = 800;
          const scale = Math.min(1, MAX / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = objUrl;
      });

      let saved = false;

      // Try server route first
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/upload-id-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(!token && user?.id ? { 'x-user-id': user.id } : {}),
          },
          body: JSON.stringify({ photo: compressed }),
        });
        if (res.ok) saved = true;
        else console.error('[ID upload] server error:', res.status, await res.text().catch(() => ''));
      } catch (fetchErr) {
        console.error('[ID upload] fetch failed:', fetchErr);
      }

      // Fallback: save directly via Supabase client
      if (!saved) {
        const { error } = await supabase
          .from('profiles')
          .update({ id_photo_url: compressed })
          .eq('id', user.id);
        if (!error) saved = true;
        else console.error('[ID upload] supabase fallback error:', error.message);
      }

      if (saved) {
        setIdUploaded(true);
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const updated = { ...stored, id_photo_url: compressed };
        localStorage.setItem('currentUser', JSON.stringify(updated));
        onProfileUpdate?.(updated);
        showToast?.('ID photo submitted for review');
      } else {
        showToast?.('Upload failed — please try again');
      }
    } catch (err) {
      console.error('ID photo upload error:', err);
    } finally {
      setIdUploading(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      setAvatarUrl(compressed);
      onAvatarUpdate(compressed);

      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(!token && user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify({ avatar: compressed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Avatar upload failed:', err);
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: compressed }));
        return;
      }

      const { url } = await res.json();
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: url }));
    } catch (err) {
      console.error('Avatar upload error:', err);
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: stored.avatar_url || null }));
    } finally {
      setUploading(false);
    }
  };

  const toggleInterest = (id) => {
    setEditForm(f => ({
      ...f,
      interests: f.interests.includes(id) ? f.interests.filter(i => i !== id) : [...f.interests, id],
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(!token && user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify({
          course: editForm.course,
          year_level: editForm.year_level,
          interests: editForm.interests,
        }),
      });
      if (res.ok) {
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const updated = { ...stored, ...editForm };
        localStorage.setItem('currentUser', JSON.stringify(updated));
        onProfileUpdate?.(updated);
        setEditing(false);
      } else {
        console.error('[saveProfile] failed:', await res.text());
      }
    } catch (err) {
      console.error('[saveProfile] error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 15px' }}>
          <div style={{ width: 90, height: 90, border: '2px solid var(--cyber-cyan)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 'bold', color: 'var(--cyber-cyan)', overflow: 'hidden', background: 'rgba(0,240,255,0.05)' }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Change profile picture"
            style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--cyber-cyan)', color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            {uploading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-camera" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{user.full_name?.toUpperCase()}</h2>
        {user.is_verified ? (
          <div className="verified-badge" style={{ margin: '0 auto 16px' }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }} /> Verified {user.user_type || 'Student'} ✓
          </div>
        ) : (
          <div className="verified-badge" style={{ margin: '0 auto 16px', borderColor: 'var(--orange)', color: 'var(--orange)', background: 'rgba(247,169,79,0.05)' }}>
            <i className="fa-solid fa-clock" style={{ marginRight: 6 }} /> Pending Verification
          </div>
        )}

        {/* View mode — always shown, no edit mode */}
        <>
          <div className="stats-card" style={{ textAlign: 'left', marginBottom: 16 }}>
            <div className="stat-line"><span>STUDENT ID</span><span className="stat-val" style={{ color: 'var(--cyber-yellow)', fontFamily: 'monospace' }}>{user.student_id}</span></div>
            <div className="stat-line"><span>ACTIVE CIRCLES</span><span className="stat-val">{communities.filter(c => c.id !== 'global').length}</span></div>
            {profile.course && <div className="stat-line"><span>COURSE</span><span className="stat-val">{profile.course}</span></div>}
            {profile.year_level && <div className="stat-line"><span>YEAR</span><span className="stat-val">{profile.year_level}</span></div>}
          </div>
          {profile.interests?.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>INTERESTS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.interests.map(id => (
                  <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', color: 'var(--cyber-cyan)' }}>
                    {INTEREST_LABELS[id] || id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ID upload for unverified users */}
          {!user.is_verified && (
            <div style={{ textAlign: 'left', marginBottom: 16, padding: '12px 14px', background: 'rgba(247,169,79,0.06)', border: '1px solid rgba(247,169,79,0.25)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
                <i className="fa-solid fa-id-card" style={{ marginRight: 6 }} />SCHOOL ID VERIFICATION
              </div>
              {idUploaded && (
                <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10 }}>
                  <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                  ID photo submitted — awaiting admin review
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                {idUploaded
                  ? 'Want to send a clearer photo? Upload a new one below.'
                  : 'Upload a clear photo of your CTU school ID so the admin can verify your account.'}
              </p>
              <button className="cyber-btn" onClick={() => idPhotoRef.current?.click()}
                disabled={idUploading}
                style={{ width: '100%', background: 'rgba(247,169,79,0.15)', borderColor: 'var(--orange)', color: 'var(--orange)' }}>
                {idUploading
                  ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />UPLOADING...</>
                  : <><i className="fa-solid fa-upload" style={{ marginRight: 6 }} />{idUploaded ? 'RE-UPLOAD SCHOOL ID' : 'UPLOAD SCHOOL ID'}</>
                }
              </button>
              <input ref={idPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIdPhotoUpload} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="cyber-btn danger" onClick={onLogout} style={{ width: '100%' }}>TERMINATE SESSION</button>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>CLOSE</button>
          </div>
        </>
      </div>
    </div>
  );
}

// ── AUDITION DETAIL MODAL (applicant view) ───────────────────────────────────
function AuditionDetailModal({ data, onClose }) {
  const { response: r, community: c, questions } = data;
  const statusColor = auditionStatusColor(r.status, r.phase2_result);
  const statusLabel = auditionStatusLabel(r.status, r.phase2_result);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3><i className="fa-solid fa-microphone" style={{ marginRight: 8 }}></i>My Application — {c.name}</h3>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', background: `${statusColor}10`, border: `1px solid ${statusColor}40`, borderRadius: 8 }}>
          <i className="fa-solid fa-circle-info" style={{ color: statusColor }}></i>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: statusColor }}>{statusLabel}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Submitted {new Date(r.submitted_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Phase 2 details */}
        {r.status === 'phase2' && r.phase2_details && (
          <div style={{ background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--cyber-yellow)', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              <i className="fa-solid fa-calendar" style={{ marginRight: 6 }}></i>PHASE 2 — LIVE SCREENING
            </div>
            <p style={{ fontSize: 13, color: 'white', lineHeight: 1.6 }}>{r.phase2_details}</p>
          </div>
        )}

        {/* Leader feedback */}
        {r.feedback && (
          <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              <i className="fa-solid fa-comment" style={{ marginRight: 6 }}></i>FEEDBACK FROM LEADER
            </div>
            <p style={{ fontSize: 13, color: 'white', lineHeight: 1.6 }}>{r.feedback}</p>
          </div>
        )}

        {/* Submitted answers */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
          Your Submitted Answers
        </div>
        {questions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No questions on record.</p>
        ) : (
          questions.map(q => (
            <div key={q.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{q.question}</div>
              {q.type === 'file' ? (
                r.answers[q.id]
                  ? <a href={r.answers[q.id]} target="_blank" rel="noreferrer" style={{ color: 'var(--cyber-cyan)', fontSize: 13 }}>
                      <i className="fa-solid fa-file" style={{ marginRight: 6 }}></i>View uploaded file
                    </a>
                  : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No file uploaded</span>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'white' }}>
                  {r.answers?.[q.id] || '—'}
                </div>
              )}
            </div>
          ))
        )}

        <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%', marginTop: 8 }}>CLOSE</button>
      </div>
    </div>
  );
}

// ── HARDCODED CTU AY 2025-2026 CALENDAR DATA ─────────────────────────────────
// Used as fallback when campus_events table doesn't exist yet
const CTU_CALENDAR = [
  // SEMESTER
  { id:'s1',  title:'First Day of Actual Service',        event_date:'2025-08-04', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s2',  title:'Classes Start – 1st Semester',       event_date:'2025-08-11', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s3',  title:'Classes End – 1st Semester',         event_date:'2025-12-11', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s4',  title:'Classes Start – 2nd Semester',       event_date:'2026-01-12', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s5',  title:'Classes End – 2nd Semester',         event_date:'2026-03-26', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s6',  title:'Summer Classes Start',               event_date:'2026-06-03', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s7',  title:'Summer Classes End',                 event_date:'2026-07-11', event_end_date:null,         category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s8',  title:'Graduation',                         event_date:'2026-05-01', event_end_date:'2026-07-01', category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s9',  title:'Christmas Break',                    event_date:'2025-12-15', event_end_date:'2026-01-04', category:'semester',   is_official:true, poster_name:'CTU Administration' },
  { id:'s10', title:'Summer Vacation',                    event_date:'2026-05-25', event_end_date:'2026-07-31', category:'semester',   is_official:true, poster_name:'CTU Administration' },
  // ENROLLMENT
  { id:'e1',  title:'Enrollment – 1st Year (1st Batch)',  event_date:'2025-05-12', event_end_date:'2025-05-30', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e2',  title:'Enrollment – 2nd Year',              event_date:'2025-05-13', event_end_date:'2025-05-23', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e3',  title:'Enrollment – 3rd Year',              event_date:'2025-06-16', event_end_date:'2025-06-27', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e4',  title:'Enrollment – 4th Year',              event_date:'2025-06-30', event_end_date:'2025-07-11', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e5',  title:'Enrollment – 5th/6th Year',          event_date:'2025-07-14', event_end_date:'2025-07-25', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e6',  title:'Enrollment – 1st Year (2nd Batch)',  event_date:'2025-07-21', event_end_date:'2025-08-01', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e7',  title:'Late Enrollment / Adding-Dropping',  event_date:'2025-07-28', event_end_date:'2025-08-01', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  { id:'e8',  title:'2nd Semester Enrollment',            event_date:'2026-01-05', event_end_date:'2026-01-09', category:'enrollment', is_official:true, poster_name:'CTU Administration' },
  // EXAMS
  { id:'x1',  title:'Preliminary Exams – 1st Sem',        event_date:'2025-09-15', event_end_date:'2025-09-21', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x2',  title:'Midterm Exams – 1st Sem',            event_date:'2025-10-20', event_end_date:'2025-10-26', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x3',  title:'Semi-Final Exams – 1st Sem',         event_date:'2025-11-23', event_end_date:'2025-11-29', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x4',  title:'Final Exams – 1st Sem',              event_date:'2025-12-01', event_end_date:'2025-12-07', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x5',  title:'Preliminary Exams – 2nd Sem',        event_date:'2026-02-16', event_end_date:'2026-02-22', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x6',  title:'Midterm Exams – 2nd Sem',            event_date:'2026-03-23', event_end_date:'2026-03-29', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x7',  title:'Semi-Final Exams – 2nd Sem',         event_date:'2026-04-27', event_end_date:'2026-05-03', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x8',  title:'Final Exams – 2nd Sem (Graduating)', event_date:'2026-04-27', event_end_date:'2026-05-08', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  { id:'x9',  title:'Final Exams – 2nd Sem (Non-Grad)',   event_date:'2026-05-09', event_end_date:'2026-05-15', category:'exam',       is_official:true, poster_name:'CTU Administration' },
  // SPORTS
  { id:'sp1', title:'Intramural Week',                    event_date:'2025-11-03', event_end_date:'2025-11-09', category:'sports',     is_official:true, poster_name:'CTU Administration' },
  { id:'sp2', title:'Cell Meet',                          event_date:'2025-11-14', event_end_date:null,         category:'sports',     is_official:true, poster_name:'CTU Administration' },
  { id:'sp3', title:'Tri-Meet',                           event_date:'2025-11-26', event_end_date:'2025-11-28', category:'sports',     is_official:true, poster_name:'CTU Administration' },
  // HOLIDAYS
  { id:'h1',  title:'Independence Day',                   event_date:'2025-06-12', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h2',  title:'Cebu Provincial Charter Day',        event_date:'2025-08-06', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h3',  title:'Ninoy Aquino Day',                   event_date:'2025-08-21', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h4',  title:'National Heroes Day',                event_date:'2025-08-25', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h5',  title:'Osmeña Day',                         event_date:'2025-09-09', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h6',  title:'All Saints Day',                     event_date:'2025-11-01', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h7',  title:'CTU Foundation Anniversary',         event_date:'2025-11-03', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h8',  title:'Bonifacio Day',                      event_date:'2025-11-30', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h9',  title:'Feast of the Immaculate Conception', event_date:'2025-12-08', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h10', title:'Christmas Eve',                      event_date:'2025-12-24', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h11', title:'Christmas Day',                      event_date:'2025-12-25', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h12', title:'Rizal Day',                          event_date:'2025-12-30', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h13', title:'Last Day of the Year',               event_date:'2025-12-31', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h14', title:"New Year's Day",                     event_date:'2026-01-01', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h15', title:'Maundy Thursday',                    event_date:'2026-04-02', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h16', title:'Good Friday',                        event_date:'2026-04-03', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h17', title:'Black Saturday',                     event_date:'2026-04-04', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h18', title:'Araw ng Kagitingan',                 event_date:'2026-04-09', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  { id:'h19', title:'Labor Day',                          event_date:'2026-05-01', event_end_date:null,         category:'holiday',    is_official:true, poster_name:'CTU Administration' },
  // CULTURAL
  { id:'c1',  title:'Sto. Niño Fiesta (Sinulog)',         event_date:'2026-01-18', event_end_date:null,         category:'cultural',   is_official:true, poster_name:'CTU Administration' },
  { id:'c2',  title:'Chinese New Year',                   event_date:'2026-01-29', event_end_date:null,         category:'cultural',   is_official:true, poster_name:'CTU Administration' },
  { id:'c3',  title:'Cebu City Charter Day',              event_date:'2026-02-24', event_end_date:null,         category:'cultural',   is_official:true, poster_name:'CTU Administration' },
  { id:'c4',  title:'Easter Sunday',                      event_date:'2026-04-05', event_end_date:null,         category:'cultural',   is_official:true, poster_name:'CTU Administration' },
].sort((a, b) => a.event_date.localeCompare(b.event_date));
const EVENT_CATEGORIES = [
  { key: 'all',       label: 'All Events',        icon: 'fa-solid fa-calendar-days',   color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  { key: 'semester',  label: 'Semester',           icon: 'fa-solid fa-book-open',       color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  { key: 'exam',      label: 'Exam Schedules',     icon: 'fa-solid fa-pen-to-square',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { key: 'enrollment',label: 'Enrollment',         icon: 'fa-solid fa-user-plus',       color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  { key: 'holiday',   label: 'Holidays',           icon: 'fa-solid fa-flag',            color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  { key: 'sports',    label: 'Sports / Intramural',icon: 'fa-solid fa-trophy',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { key: 'cultural',  label: 'Cultural',           icon: 'fa-solid fa-masks-theater',   color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  { key: 'seminar',   label: 'Seminar',            icon: 'fa-solid fa-chalkboard-user', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  { key: 'general',   label: 'General',            icon: 'fa-solid fa-star',            color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
];

function CampusEvents({ user, showToast }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_time: '', location: '', category: 'general' });
  const [posting, setPosting] = useState(false);
  const canPost = user?.user_type === 'Admin' || user?.user_type === 'Faculty';

  const [tableReady, setTableReady] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('campus_events')
      .select('*')
      .order('event_date', { ascending: true });
    if (error) {
      // Table doesn't exist — use hardcoded CTU calendar
      setTableReady(false);
      setEvents(CTU_CALENDAR);
    } else {
      setTableReady(true);
      // Merge: hardcoded events + any custom DB events (avoid duplicates by id)
      const dbIds = new Set((data || []).map(e => e.id));
      const merged = [
        ...CTU_CALENDAR.filter(e => !dbIds.has(e.id)),
        ...(data || []),
      ].sort((a, b) => a.event_date.localeCompare(b.event_date));
      setEvents(merged);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const postEvent = async () => {
    if (!form.title.trim() || !form.event_date) return;
    setPosting(true);
    const { error } = await supabase.from('campus_events').insert([{
      title: form.title.trim(),
      description: form.description.trim(),
      event_date: form.event_date,
      event_time: form.event_time,
      location: form.location.trim(),
      category: form.category,
      poster_id: user.id,
      poster_name: user.full_name,
      poster_type: user.user_type,
    }]);
    setPosting(false);
    if (!error) {
      setForm({ title: '', description: '', event_date: '', event_time: '', location: '', category: 'general' });
      setShowForm(false);
      loadEvents();
      showToast('EVENT_POSTED');
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    await supabase.from('campus_events').delete().eq('id', id);
    loadEvents();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = events.filter(e => filter === 'all' || e.category === filter);
  const upcoming = filtered.filter(e => new Date(e.event_date) >= today);
  const past     = filtered.filter(e => new Date(e.event_date) < today);

  const catInfo = (key) => EVENT_CATEGORIES.find(c => c.key === key) || EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

  // Mini calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const calDays = (() => {
    const { year, month } = calMonth;
    const first = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  })();

  // Map day → list of category colors for that day
  const eventsByDay = {};
  events.forEach(e => {
    const d = new Date(e.event_date + 'T00:00:00');
    if (d.getFullYear() === calMonth.year && d.getMonth() === calMonth.month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      const cat = EVENT_CATEGORIES.find(c => c.key === e.category);
      if (cat && !eventsByDay[day].includes(cat.color)) eventsByDay[day].push(cat.color);
    }
  });

  // For active filter: collect all days in this month that have events of that category
  // Also expand multi-day events to fill the range
  const activeCatColor = EVENT_CATEGORIES.find(c => c.key === filter)?.color;
  const activeCatBg = EVENT_CATEGORIES.find(c => c.key === filter)?.bg;
  const highlightedDays = new Set();
  if (filter !== 'all') {
    events.filter(e => e.category === filter).forEach(e => {
      const start = new Date(e.event_date + 'T00:00:00');
      const end = e.event_end_date ? new Date(e.event_end_date + 'T00:00:00') : start;
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getFullYear() === calMonth.year && cur.getMonth() === calMonth.month) {
          highlightedDays.add(cur.getDate());
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
  }

  const eventsOnDay = selectedDay
    ? events.filter(e => {
        const start = new Date(e.event_date + 'T00:00:00');
        const end = e.event_end_date ? new Date(e.event_end_date + 'T00:00:00') : start;
        const clicked = new Date(calMonth.year, calMonth.month, selectedDay);
        return clicked >= start && clicked <= end;
      })
    : [];

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayDate = new Date();

  return (
    <div className="c-feed fade-in">
      {/* Header */}
      <div className="post" style={{ borderLeft: '4px solid #38bdf8', marginBottom: 4, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, letterSpacing: 2, color: '#38bdf8' }}>
              <i className="fa-solid fa-calendar-days" style={{ marginRight: 10 }} />
              CAMPUS EVENTS
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              CTU–Daanbantayan AY 2025-2026 · Official Academic Calendar
            </p>
          </div>
          {canPost && (
            <button className="cyber-btn" style={{ padding: '8px 18px', fontSize: 12 }}
              onClick={() => setShowForm(o => !o)}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
              {showForm ? 'CANCEL' : 'POST EVENT'}
            </button>
          )}
        </div>

        {/* ── MINI CALENDAR ── */}
        <div className="mini-cal" style={{ marginTop: 16 }}>
          <div className="mini-cal-header">
            <button className="mini-cal-nav" onClick={() => setCalMonth(m => {
              const d = new Date(m.year, m.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}>‹</button>
            <span className="mini-cal-title">{monthNames[calMonth.month]} {calMonth.year}</span>
            <button className="mini-cal-nav" onClick={() => setCalMonth(m => {
              const d = new Date(m.year, m.month + 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}>›</button>
          </div>
          <div className="mini-cal-grid">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="mini-cal-dow">{d}</div>
            ))}
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const isToday = day === todayDate.getDate() && calMonth.month === todayDate.getMonth() && calMonth.year === todayDate.getFullYear();
              const dayColors = eventsByDay[day] || [];
              const hasEvent = dayColors.length > 0;
              const isSelected = day === selectedDay;
              const isHighlighted = highlightedDays.has(day);
              // Color the number: highlighted category color > first event color > default
              const numColor = isHighlighted ? activeCatColor : (hasEvent ? dayColors[0] : undefined);
              return (
                <div key={day}
                  className={`mini-cal-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''} ${isSelected ? 'selected' : ''}`}
                  style={{
                    ...(isHighlighted && !isSelected ? {
                      background: activeCatBg,
                      color: activeCatColor,
                      fontWeight: 800,
                      borderRadius: 8,
                      outline: `1.5px solid ${activeCatColor}`,
                    } : numColor && !isSelected ? { color: numColor, fontWeight: 700 } : {}),
                  }}
                  onClick={() => setSelectedDay(isSelected ? null : day)}>
                  {day}
                  {hasEvent && (
                    <div className="mini-cal-dots">
                      {(isHighlighted ? [activeCatColor] : dayColors).slice(0, 3).map((col, ci) => (
                        <span key={ci} className="mini-cal-dot" style={{ background: col }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Events on selected day */}
          {selectedDay && (
            <div className="mini-cal-day-events">
              {eventsOnDay.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No events on this day.</p>
              ) : eventsOnDay.map(e => {
                const cat = catInfo(e.category);
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <i className={cat.icon} style={{ color: cat.color, fontSize: 12, width: 14 }} />
                    <span style={{ fontSize: 12, color: 'white', flex: 1 }}>{e.title}</span>
                    {e.is_official && <i className="fa-solid fa-shield-halved" style={{ color: 'var(--cyber-yellow)', fontSize: 10 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Post form */}
        {showForm && canPost && (
          <div style={{ marginTop: 16, borderTop: '1px solid rgba(0,240,255,0.1)', paddingTop: 16 }}>
            <div className="input-group">
              <label>EVENT TITLE</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. BSIT Seminar on AI" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label>DATE</label>
                <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>TIME (optional)</label>
                <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
              </div>
            </div>
            <div className="input-group">
              <label>LOCATION</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. AVR, Gymnasium, Online" />
            </div>
            <div className="input-group">
              <label>CATEGORY</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {EVENT_CATEGORIES.filter(c => c.key !== 'all').map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>DESCRIPTION</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Details about the event..." rows={3} />
            </div>
            <button className="cyber-btn" onClick={postEvent} disabled={posting || !form.title.trim() || !form.event_date}>
              {posting ? 'POSTING...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />POST EVENT</>}
            </button>
          </div>
        )}
      </div>

      {/* ── FILTER TABS ── */}
      <div className="event-filter-wrap">
        {EVENT_CATEGORIES.map(c => (
          <button key={c.key}
            className={`event-filter-btn ${filter === c.key ? 'active' : ''}`}
            style={filter === c.key ? { borderColor: c.color, background: c.bg, color: c.color } : {}}
            onClick={() => {
              setFilter(c.key);
              setSelectedDay(null);
              // Jump calendar to the month of the first upcoming event in this category
              const now = new Date();
              const categoryEvents = c.key === 'all' ? events : events.filter(e => e.category === c.key);
              // Prefer upcoming, fall back to first ever
              const upcoming = categoryEvents.filter(e => new Date(e.event_date + 'T00:00:00') >= now);
              const target = upcoming[0] || categoryEvents[0];
              if (target) {
                const d = new Date(target.event_date + 'T00:00:00');
                setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
              }
            }}>
            <i className={c.icon} style={{ marginRight: 5, fontSize: 11 }} />
            {c.label}
          </button>
        ))}
      </div>

      {/* ── COLOR LEGEND ── */}
      <div className="event-legend">
        {EVENT_CATEGORIES.filter(c => c.key !== 'all').map(c => (
          <div key={c.key} className="event-legend-item">
            <span className="event-legend-dot" style={{ background: c.color }} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, display: 'block', marginBottom: 10 }} />
          LOADING EVENTS...
        </div>
      ) : filtered.length === 0 ? (
        <div className="post" style={{ textAlign: 'center', padding: 40 }}>
          <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 32, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No events yet. {canPost ? 'Be the first to post one!' : 'Check back later.'}</p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>
                Upcoming · {upcoming.length}
              </div>
              {upcoming.map(e => <EventCard key={e.id} e={e} user={user} onDelete={deleteEvent} catInfo={catInfo} isPast={false} />)}
            </>
          )}
          {/* Past */}
          {past.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, margin: '16px 0 10px', textTransform: 'uppercase' }}>
                Past Events · {past.length}
              </div>
              {past.map(e => <EventCard key={e.id} e={e} user={user} onDelete={deleteEvent} catInfo={catInfo} isPast={true} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ e, user, onDelete, catInfo, isPast }) {
  const cat = catInfo(e.category);
  const dateObj = new Date(e.event_date + 'T00:00:00');
  const dateStr = dateObj.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const canDelete = user?.user_type === 'Admin' || user?.id === e.poster_id;
  const isMultiDay = e.event_end_date && e.event_end_date !== e.event_date;
  const endObj = isMultiDay ? new Date(e.event_end_date + 'T00:00:00') : null;

  return (
    <div className="event-card" style={{ opacity: isPast ? 0.65 : 1 }}>
      <div className="event-card-left" style={{ borderColor: cat.color }}>
        <div className="event-date-box">
          <span className="event-day">{dateObj.getDate()}</span>
          <span className="event-month">{dateObj.toLocaleDateString([], { month: 'short' }).toUpperCase()}</span>
        </div>
      </div>
      <div className="event-card-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: `1px solid ${cat.color}`, color: cat.color, fontWeight: 700 }}>
                <i className={cat.icon} style={{ marginRight: 4 }} />{cat.label.toUpperCase()}
              </span>
              {e.is_official && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--cyber-yellow)', color: 'var(--cyber-yellow)', fontWeight: 700 }}>
                  <i className="fa-solid fa-shield-halved" style={{ marginRight: 4 }} />OFFICIAL
                </span>
              )}
              {isPast && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Past</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'white', marginBottom: 4 }}>{e.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>
                <i className="fa-solid fa-calendar" style={{ marginRight: 4 }} />
                {dateStr}{isMultiDay ? ` → ${endObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </span>
              {e.event_time && <span><i className="fa-solid fa-clock" style={{ marginRight: 4 }} />{e.event_time}</span>}
              {e.location && <span><i className="fa-solid fa-location-dot" style={{ marginRight: 4 }} />{e.location}</span>}
            </div>
            {e.description && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{e.description}</p>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
              Posted by {e.poster_name} · {e.poster_type}
            </div>
          </div>
          {canDelete && (
            <button className="chat-action-btn" onClick={() => onDelete(e.id)} title="Delete event"
              style={{ color: 'var(--red)', flexShrink: 0 }}>
              <i className="fa-solid fa-trash-can" />
            </button>
          )}
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
  const [viewingProfile, setViewingProfile] = useState(null); // student_id string
  const [showManage, setShowManage] = useState(false);
  const [showAuditionForm, setShowAuditionForm] = useState(null);
  const [myAuditions, setMyAuditions] = useState([]);
  const [viewingAudition, setViewingAudition] = useState(null); // { response, community, questions }
  const [search, setSearch] = useState('');
  const [clock, setClock] = useState(new Date());
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [announcements, setAnnouncements] = useState([]);
  const [circleAnnouncements, setCircleAnnouncements] = useState([]);
  const [newPost, setNewPost] = useState({ title: '', content: '', post_type: 'general', anonymous: false });
  const [newCirclePost, setNewCirclePost] = useState({ title: '', content: '' });
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [showCircleAnnouncements, setShowCircleAnnouncements] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const toastTimer = useRef(null);
  const feedBottomRef = useRef(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(loadTheme);
  const [navAvatarUrl, setNavAvatarUrl] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return stored?.avatar_url || null;
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  const loadMyAuditions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('audition_responses')
      .select('community_id, status, phase2_result, id')
      .eq('applicant_id', user.id);
    setMyAuditions(data || []);
  }, [user?.id]);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase.from('announcements')
      .select('*')
      .is('community_id', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
  }, []);

  const loadCircleAnnouncements = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setCircleAnnouncements([]); return; }
    const { data } = await supabase.from('announcements')
      .select('*')
      .eq('community_id', commId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setCircleAnnouncements(data || []);
  }, []);

  const postAnnouncement = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    // All verified users can pick announcement, shoutout, or general
    // Only admins/faculty can also pick 'event'
    const allowedTypes = (user?.user_type === 'Admin' || user?.user_type === 'Faculty')
      ? ['announcement', 'event', 'shoutout', 'general']
      : ['announcement', 'shoutout', 'general'];
    const type = allowedTypes.includes(newPost.post_type) ? newPost.post_type : 'general';
    setPostingAnnouncement(true);
    const { error } = await supabase.from('announcements').insert([{
      author_id: user.id,
      author_name: newPost.anonymous ? 'Anonymous' : user.full_name,
      author_type: newPost.anonymous ? 'Anonymous' : user.user_type,
      title: newPost.title.trim(),
      content: newPost.content.trim(),
      post_type: type,
      community_id: null,
    }]);
    setPostingAnnouncement(false);
    if (!error) { setNewPost({ title: '', content: '', post_type: 'general', anonymous: false }); loadAnnouncements(); }
  };

  const postCircleAnnouncement = async (commId) => {
    if (!newCirclePost.title.trim() || !newCirclePost.content.trim()) return;
    setPostingAnnouncement(true);
    const { error } = await supabase.from('announcements').insert([{
      author_id: user.id,
      author_name: user.full_name,
      author_type: user.user_type,
      title: newCirclePost.title.trim(),
      content: newCirclePost.content.trim(),
      post_type: 'announcement',
      community_id: commId,
    }]);
    setPostingAnnouncement(false);
    if (!error) {
      setNewCirclePost({ title: '', content: '' });
      loadCircleAnnouncements(commId);

      // Notify all active members of this circle
      const { data: members } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('community_id', commId)
        .eq('status', 'active')
        .neq('user_id', user.id); // don't notify yourself

      if (members && members.length > 0) {
        const comm = communities.find(c => c.id === commId);
        const notifications = members.map(m => ({
          user_id: m.user_id,
          type: 'new_announcement',
          message: `New announcement in "${comm?.name || 'a circle'}": ${newCirclePost.title.trim()}`,
          link_comm_id: commId,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  };

  const togglePin = async (id, pinned) => {
    await supabase.from('announcements').update({ pinned: !pinned }).eq('id', id);
    loadAnnouncements();
  };

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
    setNotifications(data || []);
  }, [user?.id]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const loadMessages = useCallback(async (commId, channelId) => {
    if (commId === 'global') {
      const { data } = await supabase.from('messages').select('*')
        .is('community_id', null).order('created_at', { ascending: true });
      setMessages(data || []);
    } else if (channelId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('channel_id', channelId).order('created_at', { ascending: true });
      setMessages(data || []);
    } else if (commId) {
      // No channel selected — load all messages for this community
      const { data } = await supabase.from('messages').select('*')
        .eq('community_id', commId)
        .is('channel_id', null)
        .order('created_at', { ascending: true });
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
          const isCommunityNoChannel = activeCommId !== 'global' && !activeChannelId && msg.community_id === activeCommId && !msg.channel_id;
          if (isGlobal || isChannel || isCommunityNoChannel) {
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

  useEffect(() => { loadCommunities(); loadMyMemberships(); loadMyAuditions(); loadAnnouncements(); loadNotifications(); }, [loadCommunities, loadMyMemberships, loadMyAuditions, loadAnnouncements, loadNotifications]);

  // Avatar is persisted in localStorage — no DB sync needed on mount

  // Realtime home feed (campus-wide announcements)
  useEffect(() => {
    const sub = supabase.channel('rt:announcements:global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          if (!payload.new.community_id) {
            setAnnouncements(prev => {
              if (prev.find(a => a.id === payload.new.id)) return prev;
              const updated = [payload.new, ...prev];
              return updated.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            });
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' },
        (payload) => setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' },
        (payload) => {
          if (!payload.new.community_id) {
            setAnnouncements(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // Realtime notifications
  useEffect(() => {
    if (!user?.id) return;
    const sub = supabase.channel('notifications:' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new, ...prev])
      ).subscribe();
    return () => supabase.removeChannel(sub);
  }, [user?.id]);

  // Realtime circle announcements
  useEffect(() => {
    if (!activeCommId || activeCommId === 'global') return;
    const sub = supabase.channel('announcements:' + activeCommId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements', filter: `community_id=eq.${activeCommId}` },
        (payload) => setCircleAnnouncements(prev => [payload.new, ...prev])
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'announcements' },
        (payload) => setCircleAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'announcements' },
        (payload) => setCircleAnnouncements(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a))
      )
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeCommId]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initials = user?.full_name
    ? user.full_name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const logout = () => {
    if (confirm('TERMINATE_SESSION?')) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('accessToken');
      navigate('/');
    }
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
  const getMyAudition = (commId) => myAuditions.find(a => a.community_id === commId);

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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || localStorage.getItem('accessToken');
    const params = new URLSearchParams({ id });
    if (user?.id) params.set('userId', user.id);
    try {
      const res = await fetch(`/api/delete-community?${params}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Failed to delete circle.'); return; }
      showToast('Circle deleted.');
      await loadCommunities();
      setActiveCommId('global'); setSection('home');
    } catch (err) {
      showToast('Network error — could not delete circle.');
    }
  };

  const leaveCircle = async (commId) => {
    if (!confirm('Leave this circle? You will need to request to join again.')) return;
    const membership = getMembership(commId);
    if (!membership) return;
    const { error } = await supabase.from('memberships').delete().eq('id', membership.id);
    if (error) { showToast('Failed to leave circle.'); return; }
    showToast('You have left the circle.');
    await loadMyMemberships();
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

  // Reload communities when entering a circle to ensure cover_url is fresh
  useEffect(() => {
    if (section === 'circles' && activeCommId && activeCommId !== 'global') {
      // Fetch cover_url specifically for the active community
      supabase.from('communities').select('id, cover_url').eq('id', activeCommId).single()
        .then(({ data }) => {
          if (data?.cover_url) {
            setCommunities(prev => prev.map(c =>
              c.id === activeCommId ? { ...c, cover_url: data.cover_url } : c
            ));
          }
        });
    }
  }, [section, activeCommId]);
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
      {/* PENDING BANNER */}
      {!user?.is_verified && (
        <div className="pending-banner">
          <i className="fa-solid fa-clock" style={{ marginRight: 8 }}></i>
          Your account is pending admin verification. You can browse but cannot post, message, or join circles yet.
        </div>
      )}

      {/* TOP NAV */}
      <nav className="top-nav-bar">
        {/* LEFT — hamburger (mobile) + date & time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(o => !o)}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="nav-clock">
          <span className="nav-clock-time">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="nav-clock-date">
            {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
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
                        <i className={(c.icon || getCategoryIcon(c.category))} style={{ color: 'var(--cyber-cyan)', marginRight: 10 }}></i>
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

        {/* RIGHT — notifications + user hud */}
        <div className="user-hud">
          {/* Theme Picker Button */}
          <button
            className="notif-bell"
            onClick={() => setShowThemePicker(true)}
            title="Change Theme"
            style={{ marginRight: 4 }}
          >
            <i className="fa-solid fa-palette"></i>
          </button>

          {/* Notification Bell */}
          <div className="notif-wrap" ref={notifRef}>
            <button className="notif-bell" onClick={() => { setShowNotifications(o => !o); markAllRead(); }}>
              <i className="fa-solid fa-bell"></i>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="notif-dot">{notifications.filter(n => !n.is_read).length}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--cyber-cyan)', fontSize: 11, cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <i className="fa-solid fa-bell-slash"></i>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => {
                        markRead(n.id);
                        if (n.link_comm_id) { setActiveCommId(n.link_comm_id); setSection('circles'); }
                        setShowNotifications(false);
                      }}>
                      <div className="notif-icon">
                        <i className={notifIcon(n.type)}></i>
                      </div>
                      <div className="notif-content">
                        <p className="notif-msg">{n.message}</p>
                        <span className="notif-time">{timeAgo(n.created_at)}</span>
                      </div>
                      {!n.is_read && <div className="notif-unread-dot"></div>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="hud-chip">
            <span className="hud-label">USER_ID:</span>
            <span className="hud-value">{user?.student_id}</span>
          </div>
          <div className="hud-avatar" onClick={() => setShowProfile(true)}>
            {navAvatarUrl
              ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>
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
              <i className={c.id === 'global' ? 'fa-solid fa-earth-asia' : (c.icon || (c.icon || getCategoryIcon(c.category)))}></i>
            </div>
          ))}
          {user?.is_verified && (
            <div className="dock-add-btn" title="Create Circle" onClick={() => setShowCreate(true)}>+</div>
          )}
        </div>

        {/* SIDEBAR BACKDROP (mobile) */}
        {mobileSidebarOpen && (
          <div className="sidebar-backdrop show" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* SIDEBAR — context aware */}
        <div className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
          {activeCommId === 'global' ? (
            /* ── GLOBAL / HOME sidebar ── */
            <>
              <div className="sidebar-brand-area">
                <h2 className="sidebar-title">NEXO <span className="cyan-text">CONNECT</span></h2>
              </div>
              <div className="sidebar-scroll">
              <div className="sidebar-label">MAIN</div>
              <div className="nav-links">
                <div className={`ls-item ${section === 'home' ? 'active' : ''}`} onClick={() => { setSection('home'); setMobileSidebarOpen(false); }}>
                  <i className="nav-icon fa-solid fa-house-chimney"></i>
                  <span className="node-name">Home Feed</span>
                </div>
                <div className={`ls-item ${section === 'global' ? 'active' : ''}`} onClick={() => { setSection('global'); setActiveCommId('global'); setMobileSidebarOpen(false); }}>
                  <i className="nav-icon fa-solid fa-message"></i>
                  <span className="node-name">Global Feed</span>
                </div>
                <div className={`ls-item ${section === 'activity' && activeCategory === 'all' ? 'active' : ''}`} onClick={() => { setSection('activity'); setActiveCategory('all'); }}>
                  <i className="nav-icon fa-solid fa-compass"></i>
                  <span className="node-name">Explore</span>
                </div>
              </div>
              <div className="sidebar-label" style={{ marginTop: 12 }}>CATEGORIES</div>
              <div className="nav-links">
                {[
                  { key: 'academic', label: 'Academic',  icon: 'fa-solid fa-graduation-cap' },
                  { key: 'project',  label: 'Projects',  icon: 'fa-solid fa-flask' },
                  { key: 'hobby',    label: 'Hobbies',   icon: 'fa-solid fa-gamepad' },
                  { key: 'social',   label: 'Social',    icon: 'fa-solid fa-user-group' },
                ].map(cat => (
                  <div key={cat.key}
                    className={`ls-item ${section === 'activity' && activeCategory === cat.key ? 'active' : ''}`}
                    onClick={() => { setSection('activity'); setActiveCategory(cat.key); }}
                  >
                    <i className={`nav-icon ${cat.icon}`} style={{ fontStyle: 'normal' }}></i>
                    <span className="node-name">{cat.label}</span>
                  </div>
                ))}
              </div>
              <div className="sidebar-label" style={{ marginTop: 12 }}>CAMPUS LIFE</div>
              <div className="nav-links">
                <div className={`ls-item ${section === 'events' ? 'active' : ''}`}
                  onClick={() => { setSection('events'); setMobileSidebarOpen(false); }}>
                  <i className="nav-icon fa-solid fa-calendar-days"></i>
                  <span className="node-name">Campus Events</span>
                </div>
              </div>
              </div>
            </>
          ) : (
            /* ── CIRCLE sidebar ── */
            <>
              <div className="sidebar-brand-area" style={{ paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    <i className={activeComm.icon || activeComm.faIcon || getCategoryIcon(activeComm.category)} style={{ color: 'var(--cyber-cyan)' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: 1 }}>{activeComm.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{activeComm.category || 'circle'}</div>
                  </div>
                </div>
              </div>

              <div className="sidebar-scroll">
              <div className="sidebar-label">CHANNELS</div>
              <div className="nav-links">
                {/* Announcements — always first, powered by announcements table */}
                <div
                  className={`ls-item ${showCircleAnnouncements ? 'active' : ''}`}
                  onClick={() => { setShowCircleAnnouncements(true); setSection('circles'); }}
                >
                  <i className="channel-hash">#</i>
                  <span className="node-name">announcements</span>
                  {circleAnnouncements.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{circleAnnouncements.length}</span>
                  )}
                </div>

                {channels.length === 0 && (
                  <div style={{ padding: '8px 15px', fontSize: 12, color: 'var(--text-muted)' }}>
                    No channels yet.
                  </div>
                )}
                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className={`ls-item ${activeChannelId === ch.id ? 'active' : ''}`}
                    onClick={() => { setActiveChannelId(ch.id); setSection('circles'); setShowCircleAnnouncements(false); }}
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

              </div>{/* end sidebar-scroll */}

              <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,240,255,0.08)', flexShrink: 0 }}>
                {!isOwner && isMember(activeCommId) && activeCommId !== 'global' && (
                  <div className="ls-item" style={{ color: 'var(--red)', marginBottom: 4 }}
                    onClick={() => leaveCircle(activeCommId)}>
                    <i className="nav-icon fa-solid fa-right-from-bracket"></i>
                    <span className="node-name">Leave Circle</span>
                  </div>
                )}
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
                  <p className="home-hero-welcome">Welcome, Technologist.</p>
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
                  {user?.is_verified ? (
                    <div className="verified-badge">
                      <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i> Verified {user?.user_type || 'Student'} ✓
                    </div>
                  ) : (
                    <div className="verified-badge" style={{ borderColor: 'var(--orange)', color: 'var(--orange)', background: 'rgba(247,169,79,0.05)' }}>
                      <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i> Pending Verification
                    </div>
                  )}
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 15 }}>
                    Monitoring real-time network activity across all CTU circles.
                  </p>
                </div>
                <div className="stats-card">
                  <h4 style={{ fontSize: 11, color: 'var(--cyber-yellow)', marginBottom: 15, letterSpacing: 2 }}>QUICK_STATS</h4>
                  <div className="stat-line">My Circles <span className="stat-val">{myCircles.filter(c => c.id !== 'global').length}</span></div>
                  <div className="stat-line">Network Status <span className="stat-val" style={{ color: '#00ff00' }}>ONLINE</span></div>
                  <div className="stat-line">Clearance <span className="stat-val">{user?.user_type?.toUpperCase()}</span></div>
                </div>
              </div>

              {/* ── POST COMPOSER — verified users only ── */}
              {user?.is_verified && (
                <div className="home-post-composer">
                  <div className="home-composer-header">
                    <div className="home-composer-avatar">
                      {navAvatarUrl
                        ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials
                      }
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary, white)' }}>Share something with the campus</span>
                  </div>
                  <input
                    className="home-composer-title"
                    placeholder="Title"
                    value={newPost.title}
                    onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                  />
                  <textarea
                    className="home-composer-body"
                    placeholder="What's on your mind? Share news, events, shoutouts..."
                    value={newPost.content}
                    onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                    rows={3}
                  />
                  <div className="home-composer-footer">
                    {/* Post type selector — all verified users get announcement/shoutout/general, admin/faculty also get event */}
                    <div className="home-composer-types">
                      {(user?.user_type === 'Admin' || user?.user_type === 'Faculty'
                        ? ['announcement', 'event', 'shoutout', 'general']
                        : ['announcement', 'shoutout', 'general']
                      ).map(t => {
                        const cfg = POST_TYPE[t];
                        return (
                          <button key={t}
                            className={`home-type-btn ${newPost.post_type === t ? 'active' : ''}`}
                            style={{ '--type-color': cfg.color }}
                            onClick={() => setNewPost(p => ({ ...p, post_type: t }))}>
                            <i className={cfg.icon}></i> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Anonymous toggle */}
                      <button
                        className={`home-anon-btn ${newPost.anonymous ? 'active' : ''}`}
                        onClick={() => setNewPost(p => ({ ...p, anonymous: !p.anonymous }))}
                        title={newPost.anonymous ? 'Posting anonymously — click to use your name' : 'Post anonymously'}>
                        <i className="fa-solid fa-user-secret"></i>
                        <span>{newPost.anonymous ? 'Anonymous' : 'Post as me'}</span>
                      </button>
                      <button className="cyber-btn"
                        style={{ width: 'auto', padding: '8px 22px', fontSize: 12 }}
                        disabled={postingAnnouncement || !newPost.title.trim() || !newPost.content.trim()}
                        onClick={postAnnouncement}>
                        {postingAnnouncement
                          ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Posting...</>
                          : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Post</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CAMPUS FEED ── */}
              <div className="home-section-header" style={{ marginTop: 4 }}>
                <span><i className="fa-solid fa-bullhorn" style={{ marginRight: 8, color: 'var(--cyber-cyan)' }}></i>Campus Feed</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{announcements.length} posts</span>
              </div>

              {announcements.length === 0 ? (
                <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                  <i className="fa-solid fa-bullhorn" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {user?.is_verified ? 'No posts yet. Be the first to share something!' : 'No posts yet. Verify your account to post.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {announcements.map(a => (
                    <AnnouncementCard key={a.id} a={a} user={user}
                      onPin={togglePin}
                      onDelete={deleteAnnouncement} />
                  ))}
                </div>
              )}

              {/* Featured Communities — based on user interests */}
              {(() => {
                const categoryMap = {
                  coding: 'project', design: 'hobby', gaming: 'hobby',
                  music: 'hobby', sports: 'social', research: 'academic',
                  art: 'hobby', photography: 'hobby', writing: 'hobby',
                  robotics: 'project', business: 'academic', cooking: 'hobby',
                  travel: 'social', anime: 'hobby', fitness: 'social', debate: 'academic',
                  reading: 'hobby', podcasting: 'hobby', language_learning: 'academic',
                  bl_gl: 'social', esports: 'hobby', dancing: 'social',
                };
                const userInterests = user?.interests || [];
                const matchedCategories = [...new Set(userInterests.map(i => categoryMap[i]).filter(Boolean))];
                const allCircles = communities.filter(c => c.id !== 'global');

                // If user has interests, show matching circles first; fallback to newest
                const featuredCircles = matchedCategories.length > 0
                  ? [
                      ...allCircles.filter(c => matchedCategories.includes(c.category)),
                      ...allCircles.filter(c => !matchedCategories.includes(c.category)),
                    ].slice(0, 4)
                  : allCircles.slice(0, 4);

                const sectionLabel = matchedCategories.length > 0 ? 'Recommended for You' : 'Featured Circles';

                return (
                  <>
                    <div className="home-section-header" style={{ marginTop: 16 }}>
                      <span>{sectionLabel}</span>
                      <span className="home-see-all" onClick={() => { setSection('activity'); setActiveCategory('all'); }}>See all</span>
                    </div>
                    {allCircles.length === 0 ? (
                      <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                        <i className="fa-solid fa-network-wired" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No circles yet. Be the first to create one!</p>
                        {user?.is_verified && (
                          <button className="cyber-btn" style={{ width: 'auto', padding: '8px 20px', marginTop: 12 }}
                            onClick={() => setShowCreate(true)}>
                            <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Create a Circle
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="featured-grid">
                        {featuredCircles.map(c => (
                          <div key={c.id} className="featured-card"
                            onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                            <div className="featured-card-bg" style={{
                              background: c.cover_url ? undefined : categoryGradient(c.category),
                              backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}></div>
                            <div className="featured-card-body">
                              <div className="featured-card-icon">
                                <i className={(c.icon || getCategoryIcon(c.category))}></i>
                              </div>
                              <div className="featured-card-name">{c.name}</div>
                              <div className="featured-card-desc">{c.description || 'No description provided.'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Popular Right Now — sorted by member count */}
              {communities.filter(c => c.id !== 'global').length > 0 && (
                <>
                  <div className="home-section-header" style={{ marginTop: 8 }}>
                    <span>Popular Right Now</span>
                    <span className="home-see-all" onClick={() => { setSection('activity'); setActiveCategory('all'); }}>See all</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {communities
                      .filter(c => c.id !== 'global')
                      .map(c => ({
                        ...c,
                        memberCount: myMemberships.filter(m => m.community_id === c.id && m.status === 'active').length
                          + (c.creator_id ? 1 : 0), // count creator too
                      }))
                      .sort((a, b) => b.memberCount - a.memberCount)
                      .slice(0, 4)
                      .map(c => (
                        <div key={c.id} className="popular-row"
                          onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                          <div className="popular-row-icon" style={{
                            background: c.cover_url ? undefined : categoryGradient(c.category),
                            backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}>
                            {!c.cover_url && <i className={(c.icon || getCategoryIcon(c.category))}></i>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{c.category}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontFamily: 'monospace' }}>
                              <i className="fa-solid fa-users" style={{ marginRight: 4 }} />{c.memberCount}
                            </span>
                            <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }}></i>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

            </div>
          )}

          {/* ── GLOBAL FEED — campus-wide chat ── */}
          {section === 'global' && (
            <>
              <div className="c-feed fade-in">
                <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)', marginBottom: 4 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)' }}>
                    <i className="fa-solid fa-network-wired" style={{ marginRight: 10 }}></i>GLOBAL FEED
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                    Campus-wide chat — open to all verified students and faculty.
                  </p>
                </div>

                {messages.map(m => {
                  const isOwnerMsg = m.student_id === user?.student_id;
                  return (
                    <MessageItem key={m.id} m={m}
                      tagColor="var(--cyber-cyan)"
                      isOwnerMsg={isOwnerMsg}
                      canDelete={isOwnerMsg || user?.user_type === 'Admin'}
                      onDelete={deleteMessage}
                      onEdit={editMessage}
                      onViewProfile={(sid) => setViewingProfile(sid)}
                      currentStudentId={user?.student_id}
                    />
                  );
                })}
                <div ref={feedBottomRef} />
              </div>

              {user?.is_verified && (
                <div className="composer">
                  <div className="c-input-wrap">
                    <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendPost()}
                      placeholder="Say something to the campus..." />
                    <button className="cyber-btn" onClick={sendPost}>SEND</button>
                  </div>
                </div>
              )}
            </>
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
                      const myAudition = getMyAudition(c.id);
                      return (
                        <div key={c.id} className="post" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <i className={(c.icon || getCategoryIcon(c.category))} style={{ color: 'var(--cyber-cyan)', fontSize: 16 }}></i>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid #333', padding: '2px 6px', borderRadius: 4 }}>{c.category}</span>
                            {owned && <span style={{ fontSize: 10, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '2px 6px', borderRadius: 4 }}>YOUR CIRCLE</span>}
                            {c.audition_enabled && !owned && <span style={{ fontSize: 10, color: 'var(--cyber-cyan)', border: '1px solid var(--cyber-cyan)', padding: '2px 6px', borderRadius: 4 }}><i className="fa-solid fa-microphone" style={{ marginRight: 4 }}></i>Audition Required</span>}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.description || 'No description provided.'}</p>
                        </div>
                        <div style={{ flexShrink: 0, marginLeft: 20 }}>
                          {owned || joined ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="group-action-btn manage"
                                onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                                <i className="fa-solid fa-arrow-right-to-bracket"></i> ENTER
                              </button>
                              {!owned && (
                                <button className="group-action-btn terminate"
                                  onClick={() => leaveCircle(c.id)}
                                  title="Leave circle">
                                  <i className="fa-solid fa-right-from-bracket"></i>
                                </button>
                              )}
                            </div>
                          ) : !user?.is_verified ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid #333', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-lock" style={{ marginRight: 5 }}></i>Verify to join
                            </span>
                          ) : pending ? (
                            <span style={{ fontSize: 11, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: 5 }}></i>PENDING
                            </span>
                          ) : myAudition ? (
                            <span
                              style={{
                                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                                color: auditionStatusColor(myAudition.status, myAudition.phase2_result),
                                border: `1px solid ${auditionStatusColor(myAudition.status, myAudition.phase2_result)}`,
                                cursor: 'pointer',
                              }}
                              onClick={async () => {
                                const [rRes, qRes] = await Promise.all([
                                  supabase.from('audition_responses').select('*').eq('id', myAudition.id).single(),
                                  supabase.from('audition_questions').select('*').eq('community_id', c.id).order('order_index'),
                                ]);
                                setViewingAudition({ response: rRes.data, community: c, questions: qRes.data || [] });
                              }}
                            >
                              <i className="fa-solid fa-microphone" style={{ marginRight: 5 }}></i>
                              {auditionStatusLabel(myAudition.status, myAudition.phase2_result)}
                              <i className="fa-solid fa-eye" style={{ marginLeft: 6, fontSize: 9 }}></i>
                            </span>
                          ) : (
                            c.audition_enabled ? (
                              <button className="group-action-btn manage" onClick={() => setShowAuditionForm(c)}>
                                <i className="fa-solid fa-microphone"></i> APPLY
                              </button>
                            ) : (
                              <button className="group-action-btn manage" onClick={() => requestJoin(c.id)}>
                                <i className="fa-solid fa-paper-plane"></i> REQUEST
                              </button>
                            )
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

          {/* ── CAMPUS EVENTS ── */}
          {section === 'events' && (
            <CampusEvents user={user} showToast={showToast} />
          )}

          {/* ── MY CIRCLES / CIRCLE FEED ── */}
          {section === 'circles' && (
            <>
              <div className="c-feed fade-in">
                {/* ── CIRCLE COVER BANNER ── */}
                <div className="circle-cover-banner" style={{
                  backgroundImage: activeComm.cover_url ? `url(${activeComm.cover_url})` : 'none',
                  background: activeComm.cover_url ? undefined : categoryGradient(activeComm.category),
                }}>
                  {/* Cover photo edit button — top-right, only for creator */}
                  {isOwner && (
                    <label className="circle-cover-edit-btn" title="Change circle cover photo">
                      <i className="fa-solid fa-image"></i>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const compressed = await new Promise((resolve, reject) => {
                            const img = new Image();
                            const objUrl = URL.createObjectURL(file);
                            img.onload = () => {
                              URL.revokeObjectURL(objUrl);
                              const MAX_W = 900, MAX_H = 300;
                              const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
                              const w = Math.round(img.width * scale);
                              const h = Math.round(img.height * scale);
                              const canvas = document.createElement('canvas');
                              canvas.width = w; canvas.height = h;
                              canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                              // Try progressively lower quality until under 500KB
                              let quality = 0.75;
                              let dataUrl = canvas.toDataURL('image/jpeg', quality);
                              while (dataUrl.length > 500000 && quality > 0.3) {
                                quality -= 0.1;
                                dataUrl = canvas.toDataURL('image/jpeg', quality);
                              }
                              resolve(dataUrl);
                            };
                            img.onerror = reject;
                            img.src = objUrl;
                          });

                          // Optimistically update UI immediately
                          setCommunities(prev => prev.map(c =>
                            c.id === activeComm.id ? { ...c, cover_url: compressed } : c
                          ));

                          // Save via server (uses service role key, bypasses RLS)
                          let saved = false;
                          try {
                            const token = localStorage.getItem('accessToken');
                            const serverRes = await fetch('/api/upload-cover', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                ...(!token && user?.id ? { 'x-user-id': user.id } : {}),
                              },
                              body: JSON.stringify({ cover: compressed, communityId: activeComm.id }),
                            });
                            if (serverRes.ok) {
                              saved = true;
                            } else {
                              const errBody = await serverRes.json().catch(() => ({}));
                              console.error('[cover upload] server error:', serverRes.status, errBody);
                            }
                          } catch (fetchErr) {
                            console.error('[cover upload] fetch failed:', fetchErr);
                          }

                          showToast(saved ? 'COVER_PHOTO_UPDATED' : 'UPLOAD_FAILED');
                        }}
                      />
                    </label>
                  )}
                  <div className="circle-cover-overlay">
                    <div className="circle-cover-icon">
                      <i className={activeComm.icon || getCategoryIcon(activeComm.category)}></i>
                    </div>
                    <div>
                      <h2 className="circle-cover-title">
                        {activeComm.name.toUpperCase()}
                        {activeChannelId && channels.find(c => c.id === activeChannelId) && (
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, fontSize: 15, marginLeft: 10 }}>
                            # {channels.find(c => c.id === activeChannelId)?.name}
                          </span>
                        )}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <div className="verified-badge" style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.3)' }}>
                          GROUP: {(activeComm.category || 'General').toUpperCase()} | ROLE: {myRole}
                        </div>
                      </div>
                      <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
                        {activeComm.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
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
                      activeComm.audition_enabled ? (
                        <button className="group-action-btn manage" onClick={() => setShowAuditionForm(activeComm)}>
                          <i className="fa-solid fa-microphone"></i> APPLY TO JOIN
                        </button>
                      ) : (
                        <button className="group-action-btn manage" onClick={() => requestJoin(activeCommId)}>
                          <i className="fa-solid fa-paper-plane"></i> REQUEST TO JOIN
                        </button>
                      )
                    )}
                  </div>
                ) : showCircleAnnouncements ? (
                  /* ── CIRCLE ANNOUNCEMENTS VIEW ── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Post composer — leader and co-leader only */}
                    {canModerate && (
                      <div className="announcement-composer">
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'white', marginBottom: 12 }}>
                          <i className="fa-solid fa-thumbtack" style={{ marginRight: 8, color: 'var(--cyber-yellow)' }}></i>
                          Post Circle Announcement
                        </div>
                        <input className="announcement-title-input" placeholder="Title"
                          value={newCirclePost.title}
                          onChange={e => setNewCirclePost(p => ({ ...p, title: e.target.value }))} />
                        <textarea className="announcement-body-input" placeholder="Write your announcement..."
                          value={newCirclePost.content}
                          onChange={e => setNewCirclePost(p => ({ ...p, content: e.target.value }))} />
                        <button className="cyber-btn" onClick={() => postCircleAnnouncement(activeCommId)}
                          disabled={postingAnnouncement} style={{ width: 'auto', padding: '8px 20px', marginTop: 8 }}>
                          {postingAnnouncement ? 'Posting...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Post</>}
                        </button>
                      </div>
                    )}
                    {circleAnnouncements.length === 0 ? (
                      <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                        <i className="fa-solid fa-thumbtack" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No announcements yet.</p>
                      </div>
                    ) : (
                      circleAnnouncements.map(a => (
                        <AnnouncementCard key={a.id} a={a} user={user}
                          onPin={togglePin}
                          onDelete={(id) => { deleteAnnouncement(id); loadCircleAnnouncements(activeCommId); }} />
                      ))
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
                        onViewProfile={(sid) => setViewingProfile(sid)}
                        currentStudentId={user?.student_id}
                      />
                    );
                  })
                )}
                <div ref={feedBottomRef} />
              </div>

              {isMember(activeCommId) && !showCircleAnnouncements && user?.is_verified && (
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
      {showProfile && <ProfileModal user={user} communities={myCircles} onClose={() => setShowProfile(false)} onLogout={logout} onAvatarUpdate={(url) => setNavAvatarUrl(url)} currentAvatarUrl={navAvatarUrl} showToast={showToast} onProfileUpdate={(updated) => { const u = JSON.parse(localStorage.getItem('currentUser') || '{}'); localStorage.setItem('currentUser', JSON.stringify({ ...u, ...updated })); }} />}
      {viewingProfile && <ViewProfileModal studentId={viewingProfile} onClose={() => setViewingProfile(null)} />}
      {showAuditionForm && (
        <AuditionApplicationForm
          comm={showAuditionForm}
          applicantId={user?.id}
          onSubmitted={() => { setShowAuditionForm(null); showToast('Application submitted!'); loadMyMemberships(); loadMyAuditions(); }}
          onCancel={() => setShowAuditionForm(null)}
        />
      )}
      {viewingAudition && (
        <AuditionDetailModal data={viewingAudition} onClose={() => setViewingAudition(null)} />
      )}
      <Toast message={toast} />

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <ThemePicker
          currentTheme={currentTheme}
          onClose={() => setShowThemePicker(false)}
          onThemeChange={(t) => setCurrentTheme(t)}
        />
      )}
    </div>
  );
}



