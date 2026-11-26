import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { TrustPointsBadge } from './AnnouncementCard';
import { ApplicationFormBuilder, ApplicationReviewPanel } from './ApplicationSystem';

// -- SHARED HELPERS -----------------------------------------------------------
export const CATEGORY_ICONS = {
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

export function getCategoryIcon(category) {
  const map = {
    academic: 'fa-solid fa-graduation-cap',
    project:  'fa-solid fa-flask',
    hobby:    'fa-solid fa-gamepad',
    social:   'fa-solid fa-user-group',
    system:   'fa-solid fa-earth-asia',
  };
  return map[category] || 'fa-solid fa-network-wired';
}

// rank_level: 0=Member, 1=Moderator, 2=Co-Leader, 3=Leader/Founder
export function rankLabel(level) {
  return ['Member', 'Moderator', 'Co-Leader', 'Leader'][level ?? 0] || 'Member';
}
export function rankColor(level) {
  if (level >= 3) return 'var(--cyber-yellow)';
  if (level >= 2) return 'var(--cyber-cyan)';
  if (level >= 1) return 'var(--green)';
  return 'var(--text-muted)';
}

// -- MEMBER CARD ---------------------------------------------------------------
function MemberCard({ m, onSetRank, onKick, coLeaderCount, moderatorCount, canManage = true, onGivePoints, onFlagUser, communityCategory, onUpdateRole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [trustPoints, setTrustPoints] = useState(10);
  const menuRef = useRef(null);
  const name = m.accounts?.full_name || '??';
  const initials = name !== '??'
    ? name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  // Load trust points
  useEffect(() => {
    if (!m.user_id) return;
    supabase.from('account_status')
      .select('trust_points')
      .eq('id', m.user_id)
      .single()
      .then(({ data }) => setTrustPoints(data?.trust_points ?? 10));
  }, [m.user_id]);

  const ranks = [
    { level: 2, label: 'Co-Leader',  capped: coLeaderCount >= 2 },
    { level: 1, label: 'Moderator',  capped: moderatorCount >= 3 },
    { level: 0, label: 'Member',     capped: false },
  ].filter(r => r.level !== m.rank_level);

  return (
    <div className="member-card">
      <div className="member-card-avatar">
        {m.accounts?.avatar_url ? (
          <img src={m.accounts.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
      <div className="member-card-info">
        <div className="member-card-name">{name}</div>
        <div className="member-card-sub">
          <span style={{ color: rankColor(m.rank_level), fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {rankLabel(m.rank_level)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
            {m.accounts?.ctu_id}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <TrustPointsBadge points={trustPoints} size="small" showLabel={false} />
        </div>
        {/* Project Role Dropdown - only for project communities */}
        {communityCategory === 'project' && canManage && (
          <div style={{ marginTop: 8 }}>
            <select
              value={m.project_role || ''}
              onChange={(e) => onUpdateRole && onUpdateRole(m.id, e.target.value)}
              disabled={!canManage}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: 10,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,240,255,0.2)',
                borderRadius: 4,
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">No Role</option>
              <option value="Leader">👑 Leader</option>
              <option value="Developer">💻 Developer</option>
              <option value="Designer">🎨 Designer</option>
              <option value="Tester">🧪 Tester</option>
              <option value="Other">⚙️ Other</option>
            </select>
          </div>
        )}
      </div>
      <div className="member-card-actions" ref={menuRef}>
        {canManage && onFlagUser && (
          <button
            title="Flag for admin review"
            onClick={() => onFlagUser(m)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '4px 6px', opacity: 0.5, transition: 'opacity 0.2s, color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyber-yellow)'; e.currentTarget.style.opacity = 1; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = 0.5; }}>
            <i className="fa-solid fa-flag"></i>
          </button>
        )}
        <button className="member-card-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          <i className="fa-solid fa-ellipsis-vertical"></i>
        </button>
        {menuOpen && (
          <div className="member-card-dropdown">
            {/* Give Points - always available */}
            {onGivePoints && (
              <>
                <button onClick={() => { onGivePoints(m); setMenuOpen(false); }} style={{ color: 'var(--cyber-cyan)' }}>
                  <i className="fa-solid fa-heart"></i> Give Trust Points
                </button>
                <div style={{ borderTop: '1px solid #222', margin: '4px 0' }}></div>
              </>
            )}
            
            {/* Management actions - only for leaders/co-leaders */}
            {canManage && (
              <>
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
              </>
            )}
            
            {/* Flag User - only for leaders/co-leaders */}
            {canManage && onFlagUser && (
              <button onClick={() => { onFlagUser(m); setMenuOpen(false); }} style={{ color: 'var(--cyber-yellow)' }}>
                <i className="fa-solid fa-flag"></i> Flag for Admin Review
              </button>
            )}
            
            {/* Kick - only for leaders/co-leaders */}
            {canManage && (
              <>
                <div style={{ borderTop: '1px solid #222', margin: '4px 0' }}></div>
                <button onClick={() => { onKick(m.id, name); setMenuOpen(false); }} style={{ color: 'var(--red)' }}>
                  <i className="fa-solid fa-user-xmark"></i> Kick from Circle
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -- MANAGE GROUP MODAL --------------------------------------------------------
export default function ManageGroupModal({ comm, onClose, onSaved, viewerIsOwner, viewerRankLevel = 0, onGivePoints, onFlagUser }) {
  const [form, setForm] = useState({
    name: comm.name,
    description: comm.description || '',
    category: comm.category || 'academic',
    is_open: comm.is_open !== false,
    interest_tags: Array.isArray(comm.interest_tags)
      ? comm.interest_tags
      : (comm.interest_tag ? String(comm.interest_tag).split(',').map(t => t.trim()).filter(Boolean) : []),
  });
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leader, setLeader] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(viewerIsOwner ? 'settings' : 'members');
  const [inviteSearch, setInviteSearch] = useState('');

  const sysMsg = async (text) => {
    await supabase.from('messages').insert([{
      content: 'NEXOSYS:' + text,
      message_type: 'text',
      community_id: comm.id,
      channel_id: null,
    }]);
  };
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteHasSearched, setInviteHasSearched] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(comm.logo_url || null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMode, setLogoMode] = useState(comm.logo_url ? 'photo' : 'icon'); // 'icon' | 'photo'
  const logoInputRef = useRef(null);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    // fetch leader profile with avatar
    const { data: leaderData } = await supabase
      .from('accounts')
      .select('full_name, ctu_id, account_details(avatar_url)')
      .eq('id', comm.creator_id)
      .single();
    if (leaderData) setLeader({ 
      full_name: leaderData.full_name, 
      student_id: leaderData.ctu_id, 
      avatar_url: leaderData.account_details?.avatar_url 
    });

    const { data, error } = await supabase
      .from('memberships')
      .select(`
        *,
        accounts:user_id (
          full_name,
          ctu_id,
          account_details(avatar_url)
        )
      `)
      .eq('community_id', comm.id);
    
    if (error) {
      console.error('Error fetching members:', error);
    }
    
    if (data) {
      setMembers(data.filter(m => m.status === 'active').map(m => ({
        ...m,
        accounts: {
          ...m.accounts,
          avatar_url: m.accounts?.account_details?.avatar_url
        }
      })));
      setRequests(data.filter(m => m.status === 'pending'));
    }
    setLoadingMembers(false);
  }, [comm.id, comm.creator_id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const saveSettings = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const updates = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      logo_url: logoMode === 'photo' && logoUrl ? logoUrl : null,
      is_open: form.is_open,
      interest_tags: form.interest_tags,
    };
    // Use service-role API to bypass RLS
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl(`/api/upload`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'upload-cover', ...updates, communityId: comm.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save: ' + (err.message || res.status));
        setSaving(false);
        return;
      }
      onSaved({ ...comm, ...updates, interest_tag: form.interest_tags.join(',') });
      onClose();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const SIZE = 200;
          const canvas = document.createElement('canvas');
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(SIZE / img.width, SIZE / img.height);
          const sw = img.width * scale, sh = img.height * scale;
          ctx.drawImage(img, (SIZE - sw) / 2, (SIZE - sh) / 2, sw, sh);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });
      setLogoUrl(compressed);
      setLogoMode('photo');
    } catch (err) { console.error(err); }
    finally { setLogoUploading(false); }
  };

  const approveRequest = async (memberId) => {
    const member = requests.find(r => r.id === memberId);
    const { error } = await supabase.from('memberships')
      .update({ status: 'active' }).eq('id', memberId);
    if (!error) {
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'join_approved',
          message: `Your request to join "${comm.name}" has been approved!`,
          link_comm_id: comm.id,
        }]);
      }
      await sysMsg(`${member?.accounts?.full_name || 'A user'} joined the circle.`);
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
      await sysMsg(`${name} was removed from the circle.`);
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
      const rankLabels = ['Member', 'Moderator', 'Co-Leader', 'Leader'];
      const memberName = member?.accounts?.full_name || 'A member';
      const isPromotion = level > (member?.rank_level ?? 0);
      await sysMsg(isPromotion
        ? `${memberName} was promoted to ${rankLabels[level]}.`
        : `${memberName} was set to ${rankLabels[level]}.`
      );
      fetchMembers();
    }
  };

  const updateMemberRole = async (membershipId, newRole) => {
    const { error } = await supabase
      .from('memberships')
      .update({ project_role: newRole || null })
      .eq('id', membershipId);
    
    if (error) {
      alert('Failed to update role: ' + error.message);
    } else {
      fetchMembers();
    }
  };

  const searchInviteStudent = async () => {
    if (!inviteSearch.trim()) return;
    setInviteSearching(true);
    setInviteResult(null);
    setInviteHasSearched(true);
    const { data } = await supabase.from('accounts')
      .select('id, full_name, ctu_id')
      .ilike('ctu_id', `%${inviteSearch.trim()}%`)
      .limit(1).single();
    if (data) {
      const { data: membership } = await supabase.from('memberships')
        .select('status')
        .eq('community_id', comm.id)
        .eq('user_id', data.id)
        .maybeSingle();
      setInviteResult({ ...data, student_id: data.ctu_id, membershipStatus: membership?.status || null });
    } else {
      setInviteResult(null);
    }
    setInviteSearching(false);
  };

  const inviteMember = async () => {
    if (!inviteResult) return;
    setInviting(true);
    // Check if already a member
    const { data: existing } = await supabase.from('memberships')
      .select('id, status')
      .eq('community_id', comm.id)
      .eq('user_id', inviteResult.id)
      .maybeSingle();
    if (existing) {
      alert(existing.status === 'active' ? 'This student is already a member.' : 'This student already has a pending request.');
      setInviting(false);
      return;
    }
    const { error } = await supabase.from('memberships').insert([{
      community_id: comm.id,
      user_id: inviteResult.id,
      rank_level: 0,
      status: 'invited',
    }]);
    if (!error) {
      await supabase.from('notifications').insert([{
        user_id: inviteResult.id,
        type: 'circle_invite',
        message: `You've been invited to join "${comm.name}"! Click this notification to view the circle.`,
        link_comm_id: comm.id,
      }]);
      setInviteSearch('');
      setInviteResult(null);
      alert(`Invite sent to ${inviteResult.full_name}. They can accept or decline from their notifications.`);
    } else {
      alert('Failed to send invite.');
    }
    setInviting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manage-modal-box" onClick={e => e.stopPropagation()}>
        <div className="manage-modal-header">
          <h2><i className="fa-solid fa-gear" style={{ marginRight: 10 }}></i>CIRCLE SETTINGS</h2>
          <button className="manage-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="manage-tabs">
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              <i className="fa-solid fa-sliders"></i><span> Settings</span>
            </button>
          )}
          <button className={`manage-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
            <i className="fa-solid fa-users"></i><span> Members {members.length > 0 && `(${members.length})`}</span>
          </button>
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
              <i className="fa-solid fa-user-clock"></i><span> Requests</span>
              {requests.length > 0 && <span className="req-badge">{requests.length}</span>}
            </button>
          )}
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'Application' ? 'active' : ''}`} onClick={() => setTab('Application')}>
              <i className="fa-solid fa-microphone"></i><span> Application</span>
            </button>
          )}
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'invite' ? 'active' : ''}`} onClick={() => setTab('invite')}>
              <i className="fa-solid fa-user-plus"></i><span> Invite</span>
            </button>
          )}
        </div>

        {tab === 'settings' && (viewerIsOwner || viewerRankLevel >= 2) && (
          <div className="manage-tab-content">
            {/* CIRCLE LOGO */}
            <div className="input-group">
              <label>CIRCLE IDENTITY</label>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', padding: 14 }}>
                {/* Top row: logo + inline name + category */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', background: 'rgba(0,240,255,0.1)', border: '2px solid rgba(0,240,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    {logoMode === 'photo' && logoUrl
                      ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <i className={comm.icon || getCategoryIcon(comm.category)} style={{ fontSize: 22, color: 'var(--cyber-cyan)' }} />}
                    {logoMode === 'photo' && logoUrl && (
                      <button type="button" onClick={() => { setLogoUrl(null); setLogoMode('icon'); }}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 10, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, padding: '2px 0', outline: 'none', width: '100%', fontFamily: 'inherit' }} />
                    <select value={form.category} onChange={e => {
                      const newCat = e.target.value;
                      const catInterests = { academic:['research','debate','business','language_learning','robotics','reading'], hobby:['coding','design','gaming','music','art','photography','writing','cooking','anime','fitness','podcasting','esports','dancing','bl_gl'], social:['sports','travel','fitness','dancing','esports'], project:['coding','robotics','design','business','research'] };
                      const available = catInterests[newCat] || [];
                      setForm(f => ({ ...f, category: newCat, interest_tags: f.interest_tags.filter(t => available.includes(t)) }));
                    }}
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: 12, padding: '2px 0', outline: 'none', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="academic">Academic / Study Group</option>
                      <option value="project">Special Project / Capstone</option>
                      <option value="hobby">Hobby / Interest</option>
                      <option value="social">Social / Hangout</option>
                    </select>
                  </div>
                </div>
                {/* Icon grid + Photo as full-width button below */}
                <div className="icon-picker" style={{ gap: 6, marginBottom: 8 }}>
                  {(CATEGORY_ICONS[form.category] || CATEGORY_ICONS.academic || []).map(opt => (
                    <button key={opt.icon} type="button"
                      className={`icon-pick-btn ${logoMode === 'icon' && (comm.icon === opt.icon || form.icon === opt.icon) ? 'selected' : ''}`}
                      onClick={() => { setLogoMode('icon'); setLogoUrl(null); }}
                      title={opt.label}>
                      <i className={opt.icon}></i>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                <button type="button"
                  onClick={() => { setLogoMode('photo'); logoInputRef.current?.click(); }}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1px solid ${logoMode === 'photo' ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`, background: logoMode === 'photo' ? 'rgba(0,240,255,0.08)' : 'transparent', color: logoMode === 'photo' ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: '0.15s' }}>
                  {logoUploading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-image" />}
                  {logoMode === 'photo' && logoUrl ? '✓ Photo uploaded — click to change' : 'Upload a Photo'}
                </button>
              </div>
            </div>
            <div className="input-group">
              <label>DESCRIPTION</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this channel's purpose..." />
            </div>
            <div className="input-group">
              <label>JOIN TYPE</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, is_open: true }))}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${form.is_open ? '#3ecf8e' : '#333'}`, background: form.is_open ? 'rgba(62,207,142,0.1)' : 'transparent', color: form.is_open ? '#3ecf8e' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <i className="fa-solid fa-door-open" style={{ marginRight: 6 }}></i>Open
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 3, opacity: 0.8 }}>Anyone can request to join</div>
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, is_open: false }))}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${!form.is_open ? 'var(--cyber-yellow)' : '#333'}`, background: !form.is_open ? 'rgba(252,238,10,0.08)' : 'transparent', color: !form.is_open ? 'var(--cyber-yellow)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: 6 }}></i>Closed
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 3, opacity: 0.8 }}>Invite only</div>
                </button>
              </div>
            </div>
            <div className="input-group">
              <label>INTERESTS <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>— select all that apply</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
                {(['research','debate','business','language_learning','robotics','reading','coding','design','gaming','music','art','photography','writing','cooking','anime','fitness','podcasting','esports','dancing','sports','travel']).map(interest => {
                  const label = { research:'Research', debate:'Debate', business:'Business', language_learning:'Language Learning', robotics:'Robotics', reading:'Reading', coding:'Coding', design:'Design', gaming:'Gaming', music:'Music', art:'Art', photography:'Photography', writing:'Writing', cooking:'Cooking', anime:'Anime', fitness:'Fitness', podcasting:'Podcasting', esports:'Esports', dancing:'Dancing', sports:'Sports', travel:'Travel' };
                  const catInterests = { academic:['research','debate','business','language_learning','robotics','reading'], hobby:['coding','design','gaming','music','art','photography','writing','cooking','anime','fitness','podcasting','esports','dancing','bl_gl'], social:['sports','travel','fitness','dancing','esports'], project:['coding','robotics','design','business','research'] };
                  const available = catInterests[form.category] || catInterests.academic;
                  if (!available.includes(interest)) return null;
                  const selected = form.interest_tags.includes(interest);
                  return (
                    <button key={interest} type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        interest_tags: selected
                          ? f.interest_tags.filter(t => t !== interest)
                          : [...f.interest_tags, interest]
                      }))}
                      style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${selected ? 'var(--cyber-cyan)' : '#333'}`, background: selected ? 'rgba(0,240,255,0.12)' : 'transparent', color: selected ? 'var(--cyber-cyan)' : 'var(--text-muted)', fontWeight: selected ? 700 : 400, transition: '0.15s' }}>
                      {label[interest] || interest}
                    </button>
                  );
                })}
              </div>
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
                {leader?.avatar_url ? (
                  <img src={leader.avatar_url} alt={leader.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--cyber-yellow)' }}>
                    {leader?.full_name
                      ? leader.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                      : '?'}
                  </span>
                )}
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
                    // Filter out the leader from members list to avoid duplicate display
                    const membersWithoutLeader = members.filter(m => m.user_id !== comm?.creator_id);
                    const coLeaderCount = membersWithoutLeader.filter(m => m.rank_level === 2).length;
                    const moderatorCount = membersWithoutLeader.filter(m => m.rank_level === 1).length;
                    return [
                      { label: 'Co-Leaders', filter: m => m.rank_level === 2, cap: 2 },
                      { label: 'Moderators', filter: m => m.rank_level === 1, cap: 3 },
                      { label: 'Members',    filter: m => m.rank_level === 0, cap: null },
                    ].map(({ label, filter, cap }) => {
                      const group = membersWithoutLeader.filter(filter);
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
                              canManage={viewerRankLevel >= 2}
                              onGivePoints={onGivePoints}
                              onFlagUser={viewerRankLevel >= 2 ? onFlagUser : null}
                              communityCategory={comm.category}
                              onUpdateRole={updateMemberRole}
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

        {tab === 'requests' && (viewerIsOwner || viewerRankLevel >= 2) && (
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
                      <td style={{ color: 'var(--text-primary)' }}>{r.accounts?.full_name || '??'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--cyber-cyan)' }}>{r.accounts?.ctu_id || '??'}</td>
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

        {tab === 'Application' && (viewerIsOwner || viewerRankLevel >= 2) && (
          <div className="manage-tab-content">
            <ApplicationFormBuilder
              comm={comm}
              onToggle={(enabled) => onSaved({ ...comm, application_enabled: enabled })}
            />
            {comm.application_enabled && (
              <>
                <div className="Application-section-label" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span>Applications Received</span>
                </div>
                <ApplicationReviewPanel comm={comm} />
              </>
            )}
          </div>
        )}

        {tab === 'invite' && (viewerIsOwner || viewerRankLevel >= 2) && (
          <div className="manage-tab-content">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyber-cyan)', marginBottom: 6 }}>
                <i className="fa-solid fa-user-plus" style={{ marginRight: 8 }}></i>Personal Invite
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Search for a CTU student by their Student ID and invite them directly into the circle, bypassing the Application process.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="channel-name-input"
                style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                placeholder="Enter Student ID (e.g. 1234567)"
                value={inviteSearch}
                onChange={e => { setInviteSearch(e.target.value); setInviteHasSearched(false); setInviteResult(null); }}
                onKeyDown={e => e.key === 'Enter' && searchInviteStudent()}
              />
              <button className="cyber-btn" style={{ padding: '8px 16px', fontSize: 12 }}
                onClick={searchInviteStudent} disabled={inviteSearching}>
                {inviteSearching ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
            </div>

            {inviteResult === null && inviteSearch.trim() && !inviteSearching && inviteHasSearched && (
              <p style={{ fontSize: 12, color: 'var(--red)', padding: '10px 0' }}>
                <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }}></i>No student found with that ID.
              </p>
            )}

            {inviteResult && (
              <div style={{
                background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)',
                borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div className="member-card-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                  {(inviteResult.full_name || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{inviteResult.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontFamily: 'monospace', marginTop: 2 }}>{inviteResult.student_id}</div>
                </div>
                {inviteResult.membershipStatus === 'active' ? (
                  <span style={{ padding: '8px 18px', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
                    <i className="fa-solid fa-check-circle" style={{ marginRight: 6 }}></i>Member
                  </span>
                ) : inviteResult.membershipStatus === 'invited' ? (
                  <span style={{ padding: '8px 18px', fontSize: 12, color: 'var(--cyber-cyan)', fontWeight: 700 }}>
                    <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i>Invited
                  </span>
                ) : (
                  <button className="cyber-btn" style={{ padding: '8px 18px', fontSize: 12 }}
                    onClick={inviteMember} disabled={inviting}>
                    {inviting ? 'Inviting...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Invite</>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
