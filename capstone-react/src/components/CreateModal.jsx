import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../lib/api';
import { supabase } from '../lib/supabase';
import { CATEGORY_ICONS } from './ManageGroupModal';

// getFreshToken is reproduced here (same as the one in UserPortal)
async function getFreshToken() {
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session?.access_token) {
      localStorage.setItem('accessToken', data.session.access_token);
      localStorage.setItem('refreshToken', data.session.refresh_token);
      return data.session.access_token;
    }
  } catch { /* fall through */ }
  return localStorage.getItem('accessToken');
}

// -- CREATE MODAL --------------------------------------------------------------
export default function CreateModal({ onClose, onCreated, userId }) {
  const [form, setForm] = useState({ name: '', description: '', category: 'academic', icon: 'fa-solid fa-graduation-cap', interest_tag: '', is_open: false });
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [invitees, setInvitees] = useState([]);
  const [logoMode, setLogoMode] = useState('icon'); // 'icon' | 'photo'
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

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
    } catch { /* non-fatal */ }
    setLogoUploading(false);
  };

  const INTEREST_LABELS_MAP = { research:'Research', debate:'Debate', business:'Business', language_learning:'Language Learning', robotics:'Robotics', reading:'Reading', coding:'Coding', design:'Design', gaming:'Gaming', music:'Music', art:'Art', photography:'Photography', writing:'Writing', cooking:'Cooking', anime:'Anime', fitness:'Fitness', podcasting:'Podcasting', esports:'E-Sports', dancing:'Dancing', bl_gl:'Watching BL/GL', sports:'Sports', travel:'Travel' };
  const CAT_INTERESTS = { academic:['research','debate','business','language_learning','robotics','reading'], hobby:['coding','design','gaming','music','art','photography','writing','cooking','anime','fitness','podcasting','esports','dancing','bl_gl'], social:['sports','travel','fitness','dancing','esports'], project:['coding','robotics','design','business','research'] };

  useEffect(() => {
    getFreshToken().then(token => {
      fetch(getApiUrl('/api/connections'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.json())
        .then(data => {
          const accepted = (data || []).filter(c => c.status === 'accepted');
          localStorage.setItem('nexo_connection_count', accepted.length);
          setConnections(accepted);
          setConnectionsLoaded(true);
        })
        .catch(() => setConnectionsLoaded(true));
    });
  }, []);

  // is_open must be forced on if invitees < 2
  const forcedOpen = invitees.length < 2;
  const effectiveIsOpen = forcedOpen ? true : form.is_open;

  // Sync is_open state when forced
  useEffect(() => {
    if (forcedOpen && !form.is_open) {
      setForm(f => ({ ...f, is_open: true }));
    }
  }, [forcedOpen]);

  const handleCategoryChange = (cat) => {
    const firstIcon = CATEGORY_ICONS[cat]?.[0]?.icon || 'fa-solid fa-graduation-cap';
    setForm(f => ({ ...f, category: cat, icon: firstIcon, interest_tag: '' }));
  };

  const toggleInvitee = (id) => {
    setInvitees(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const interestOptions = CAT_INTERESTS[form.category] || [];
  const icons = CATEGORY_ICONS[form.category] || [];

  // Validation: name + interest_tag required
  const canSubmit = form.name.trim() && form.interest_tag;

  const openHint = invitees.length === 0
    ? 'Required — you have no invited connections. Circle will recruit members publicly.'
    : invitees.length === 1
    ? 'Required — you need 1 more member. Circle will also recruit publicly.'
    : 'Optional — you have 2 invites. Circle can activate privately or stay open.';

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const token = localStorage.getItem('accessToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    else if (userId) headers['x-user-id'] = userId;
    try {
      const res = await fetch(getApiUrl('/api/communities'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          icon: form.icon,
          interest_tag: form.interest_tag,
          is_open: effectiveIsOpen,
          invitees,
          logo_url: logoMode === 'photo' && logoUrl ? logoUrl : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Failed to submit request.'); setLoading(false); return; }
      alert(`Your circle "${form.name.trim()}" has been submitted for admin approval. You'll be notified once it's reviewed.`);
      onClose();
    } catch {
      alert('Network error — could not submit request.');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: 480 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, color: 'var(--cyber-cyan)', marginBottom: 20 }}>CREATE NEW CIRCLE</h3>

        {/* 1. LOGO + NAME + CATEGORY — all in one card */}
        <div className="input-group">
          <label>CIRCLE IDENTITY</label>
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />

          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', padding: 14 }}>
            {/* Top row: logo + inline name + category inputs */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', background: 'rgba(0,240,255,0.1)', border: '2px solid rgba(0,240,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                {logoMode === 'photo' && logoUrl
                  ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className={form.icon} style={{ fontSize: 24, color: 'var(--cyber-cyan)' }} />}
                {logoMode === 'photo' && logoUrl && (
                  <button type="button" onClick={() => { setLogoUrl(null); setLogoMode('icon'); }}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 10, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Circle Name"
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, padding: '2px 0', outline: 'none', width: '100%', fontFamily: 'inherit' }} />
                <select value={form.category} onChange={e => handleCategoryChange(e.target.value)}
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
              {icons.map(opt => (
                <button key={opt.icon} type="button"
                  className={`icon-pick-btn ${logoMode === 'icon' && form.icon === opt.icon ? 'selected' : ''}`}
                  onClick={() => { setLogoMode('icon'); setLogoUrl(null); setForm(f => ({ ...f, icon: opt.icon })); }} title={opt.label}>
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

        {/* INTEREST TAG */}
        {interestOptions.length > 0 && (
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              CIRCLE INTEREST TAG <span style={{ color: 'var(--red)', fontSize: 12 }}>*</span>
            </label>
            <select value={form.interest_tag} onChange={e => setForm(f => ({ ...f, interest_tag: e.target.value }))}>
              <option value="">Select an interest...</option>
              {interestOptions.map(i => (
                <option key={i} value={i}>{INTEREST_LABELS_MAP[i] || i}</option>
              ))}
            </select>
            {!form.interest_tag && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Required — pick what this circle is about.</div>}
          </div>
        )}

        {/* DESCRIPTION */}
        <div className="input-group">
          <label>DESCRIPTION</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Briefly describe this circle's purpose..." />
        </div>

        {/* OPEN FOR APPLICATIONS */}
        <div className="input-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ margin: 0 }}>OPEN FOR APPLICATIONS</label>
            <input type="checkbox" checked={effectiveIsOpen}
              onChange={e => !forcedOpen && setForm(f => ({ ...f, is_open: e.target.checked }))}
              style={{ accentColor: 'var(--cyber-cyan)', width: 16, height: 16, cursor: forcedOpen ? 'not-allowed' : 'pointer', opacity: forcedOpen ? 0.6 : 1 }} />
          </div>
          <div style={{ fontSize: 11, color: forcedOpen ? 'var(--cyber-yellow)' : 'var(--text-muted)', marginTop: 6 }}>
            {forcedOpen && <i className="fa-solid fa-lock" style={{ marginRight: 5 }}></i>}
            {openHint}
          </div>
        </div>

        {/* INVITE CONNECTIONS */}
        {connectionsLoaded && connections.length > 0 && (
          <div className="input-group">
            <label>INVITE YOUR CONNECTIONS</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {connections.map(c => {
                const other = c.user_id === userId ? c.recipient : c.requester;
                const otherId = c.user_id === userId ? c.connected_user_id : c.user_id;
                const name = other?.full_name || 'Connection';
                const initials = name[0]?.toUpperCase() || '?';
                const checked = invitees.includes(otherId);
                return (
                  <div key={otherId} onClick={() => toggleInvitee(otherId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: `1px solid ${checked ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.08)'}`, background: checked ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: '0.15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '2px solid rgba(0,240,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.3)'}`, background: checked ? 'var(--cyber-cyan)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <i className="fa-solid fa-check" style={{ fontSize: 10, color: '#0d0d12' }}></i>}
                    </div>
                  </div>
                );
              })}
            </div>
            {invitees.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', marginTop: 6 }}>
                <i className="fa-solid fa-users" style={{ marginRight: 5 }}></i>
                {invitees.length} connection{invitees.length !== 1 ? 's' : ''} selected
                {invitees.length < 2 && ' — select 1 more to make Open optional'}
              </div>
            )}
          </div>
        )}

        {connectionsLoaded && connections.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
            <i className="fa-solid fa-info-circle" style={{ marginRight: 6, color: 'var(--cyber-cyan)' }}></i>
            No connections yet. Go to <strong style={{ color: 'var(--cyber-cyan)' }}>Discover People</strong> to connect with others.
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="cyber-btn" onClick={submit} disabled={loading || !canSubmit} style={{ flex: 1 }}>
            {loading ? 'SUBMITTING...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />SUBMIT FOR APPROVAL</>}
          </button>
          <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
