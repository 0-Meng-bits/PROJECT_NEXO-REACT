import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

// -- GIVE POINTS MODAL ---------------------------------------------------------
export function GivePointsModal({ targetUser, onClose, currentUser, communityId, myRankLevel }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const maxAmount = myRankLevel >= 2 ? 5 : 3;
  const maxRecipients = myRankLevel >= 2 ? 5 : 3;

  const submit = async () => {
    if (!reason.trim() || amount <= 0) return;
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/moderation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'give-appreciation', giverId: currentUser.id, receiverId: targetUser.id, amount, reason: reason.trim(), communityId })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to give points'); setSubmitting(false); return; }
      setDone(true);
    } catch { setError('Network error. Please try again.'); setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-heart" style={{ fontSize: 36, color: 'var(--cyber-cyan)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--cyber-cyan)', marginBottom: 8 }}>Points Sent!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              You gave <strong style={{ color: 'var(--cyber-yellow)' }}>{amount} point{amount !== 1 ? 's' : ''}</strong> to <strong>{targetUser.full_name}</strong>
            </p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6, color: 'var(--cyber-cyan)' }}>
              <i className="fa-solid fa-heart" style={{ marginRight: 8 }}></i>Give Trust Points
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Recognize {targetUser.full_name} for positive contributions</p>
            <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--cyber-cyan), #00a2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#000', overflow: 'hidden' }}>
                {targetUser.avatar_url ? <img src={targetUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : targetUser.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{targetUser.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{targetUser.ctu_id}</div>
              </div>
            </div>
            <div className="input-group">
              <label>POINTS TO GIVE (Max: {maxAmount})</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, myRankLevel >= 2 ? 4 : null, myRankLevel >= 2 ? 5 : null].filter(Boolean).map(val => (
                  <button key={val} onClick={() => setAmount(val)} className="cyber-btn" style={{ flex: 1, padding: '10px', fontSize: 13, background: amount === val ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.1)', color: amount === val ? '#000' : 'var(--cyber-cyan)', border: `1px solid ${amount === val ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.3)'}` }}>+{val}</button>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label>REASON (REQUIRED)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., 'Helped me understand the lesson'" style={{ width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} maxLength={200} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{reason.length}/200</div>
            </div>
            <div style={{ background: 'rgba(252,238,10,0.08)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--cyber-yellow)' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>Daily limit: {maxRecipients} recipients · Cooldown: 12 hours per person
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 6, color: myRankLevel >= 2 ? '#f5e642' : 'var(--cyber-cyan)', fontWeight: 700 }}>
                <i className={`fa-solid ${myRankLevel >= 2 ? 'fa-crown' : 'fa-user'}`} style={{ marginRight: 6 }}></i>
                Your rank: {myRankLevel >= 3 ? 'Leader' : myRankLevel >= 2 ? 'Co-Leader' : myRankLevel >= 1 ? 'Moderator' : 'Member'} — can give up to +{maxAmount} TP · {maxRecipients} people/day
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><i className="fa-solid fa-crown" style={{ marginRight: 5, color: '#f5e642' }}></i>Leader / Co-Leader</span><span>Max +5 TP · 5 people/day</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><i className="fa-solid fa-shield" style={{ marginRight: 5, color: 'var(--cyber-cyan)' }}></i>Moderator / Member</span><span>Max +3 TP · 3 people/day</span></div>
              </div>
            </div>
            {error && <div style={{ background: 'rgba(247,95,95,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>{error}</div>}
            <div className="modal-actions">
              <button className="cyber-btn" onClick={submit} disabled={submitting || !reason.trim() || amount <= 0} style={{ flex: 1 }}>{submitting ? 'Sending...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Give Points</>}</button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- FLAG USER MODAL -----------------------------------------------------------
export function FlagUserModal({ targetUser, onClose, currentUser, communityId }) {
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const SEVERITIES = [
    { value: 'minor', label: 'Minor', desc: 'Small issue, needs attention', color: 'var(--orange)' },
    { value: 'moderate', label: 'Moderate', desc: 'Concerning behavior', color: 'var(--cyber-yellow)' },
    { value: 'severe', label: 'Severe', desc: 'Serious violation', color: 'var(--red)' },
    { value: 'critical', label: 'Critical', desc: 'Immediate admin action needed', color: '#ff0000' },
  ];

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/moderation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'flag-user', flaggerId: currentUser.id, flaggedUserId: targetUser.id, communityId, reason: reason.trim(), severity })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to flag user'); setSubmitting(false); return; }
      setDone(true);
    } catch { setError('Network error. Please try again.'); setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-flag-checkered" style={{ fontSize: 36, color: 'var(--cyber-yellow)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--cyber-yellow)', marginBottom: 8 }}>Flag Submitted</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>A system admin will review this flag within 24-48 hours.</p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6, color: 'var(--cyber-yellow)' }}><i className="fa-solid fa-flag" style={{ marginRight: 8 }}></i>Flag User for Admin Review</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>This will notify admins to review {targetUser.full_name}'s behavior.</p>
            <div style={{ background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.15)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--cyber-yellow), #f5a623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#000', overflow: 'hidden' }}>
                {targetUser.avatar_url ? <img src={targetUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : targetUser.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{targetUser.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{targetUser.ctu_id}</div>
              </div>
            </div>
            <div className="input-group">
              <label>SEVERITY LEVEL</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SEVERITIES.map(s => (
                  <label key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, padding: '10px 12px', borderRadius: 8, border: `1px solid ${severity === s.value ? s.color : 'rgba(255,255,255,0.08)'}`, background: severity === s.value ? `${s.color}15` : 'transparent', transition: '0.15s' }}>
                    <input type="radio" name="severity" value={s.value} checked={severity === s.value} onChange={() => setSeverity(s.value)} style={{ accentColor: s.color }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: severity === s.value ? s.color : 'var(--text-primary)' }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label>REASON (REQUIRED)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the issue in detail." style={{ width: '100%', minHeight: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} maxLength={500} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{reason.length}/500</div>
            </div>
            <div style={{ background: 'rgba(247,95,95,0.08)', border: '1px solid rgba(247,95,95,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--red)' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>False flagging may result in consequences for your account.
            </div>
            {error && <div style={{ background: 'rgba(247,95,95,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>{error}</div>}
            <div className="modal-actions">
              <button className="cyber-btn" onClick={submit} disabled={submitting || !reason.trim()} style={{ flex: 1, background: 'rgba(252,238,10,0.15)', color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)' }}>{submitting ? 'Submitting...' : <><i className="fa-solid fa-flag" style={{ marginRight: 6 }}></i>Submit Flag</>}</button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- WARNING HISTORY MODAL -----------------------------------------------------
export function WarningHistoryModal({ userId, onClose, onAppeal }) {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    const load = async () => {
      const { data: warnData } = await supabase.from('user_warnings').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (!warnData?.length) { setWarnings([]); setLoading(false); return; }
      const warningIds = warnData.map(w => w.id);
      const { data: appeals } = await supabase.from('warning_appeals').select('warning_id, appeal_reason').in('warning_id', warningIds);
      const appealMap = {};
      (appeals || []).forEach(a => { appealMap[a.warning_id] = a.appeal_reason; });
      setWarnings(warnData.map(w => ({ ...w, appeal_reason: appealMap[w.id] || null })));
      setLoading(false);
    };
    load();
  }, [userId]);

  const getSeverityColor = (s) => {
    if (s === 'critical') return 'var(--red)';
    if (s === 'severe') return '#ff5555';
    if (s === 'moderate') return 'var(--cyber-yellow)';
    return 'var(--orange)';
  };

  const getStatusBadge = (status) => {
    const map = { active: { label: 'Active', color: 'var(--red)', bg: 'rgba(247,95,95,0.15)' }, appealed: { label: 'Appealed', color: 'var(--cyber-yellow)', bg: 'rgba(252,238,10,0.15)' }, overturned: { label: 'Overturned', color: '#3ecf8e', bg: 'rgba(62,207,142,0.15)' }, expired: { label: 'Expired', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' } };
    const s = map[status] || map.active;
    return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}` }}>{s.label}</span>;
  };

  const filtered = warnings.filter(w => {
    if (tab === 'active') return w.status === 'active';
    if (tab === 'appealed') return w.status === 'appealed';
    if (tab === 'overturned') return w.status === 'overturned' || w.status === 'expired';
    return true;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 650, maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: 6, color: 'var(--red)' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>Warning History</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>All warnings issued to your account.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
          {['active', 'appealed', 'overturned'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'rgba(0,240,255,0.1)' : 'transparent', border: 'none', borderBottom: tab === t ? '2px solid var(--cyber-cyan)' : '2px solid transparent', color: tab === t ? 'var(--cyber-cyan)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', transition: '0.2s' }}>
              {t} ({warnings.filter(w => t === 'overturned' ? (w.status === 'overturned' || w.status === 'expired') : w.status === t).length})
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10 }}></i><p>Loading warnings...</p></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}><i className="fa-solid fa-circle-check" style={{ fontSize: 32, color: '#3ecf8e', marginBottom: 10 }}></i><p>No {tab} warnings</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(w => (
              <div key={w.id} style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${getSeverityColor(w.severity)}`, borderRadius: 10, padding: 16, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: getSeverityColor(w.severity), textTransform: 'uppercase', letterSpacing: 1 }}>{w.severity}</span>
                      {getStatusBadge(w.status)}
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{w.reason}</p>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)', marginLeft: 12 }}>-{w.points_deducted} pts</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <i className="fa-solid fa-clock" style={{ marginRight: 4 }}></i>
                  {new Date(w.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {w.status === 'active' && (
                  <button onClick={() => onAppeal(w)} style={{ marginTop: 12, width: '100%', background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', color: 'var(--cyber-cyan)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <i className="fa-solid fa-gavel"></i>Appeal This Warning
                  </button>
                )}
                {w.appeal_reason && (
                  <div style={{ marginTop: 10, padding: 10, background: 'rgba(252,238,10,0.08)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyber-yellow)', marginBottom: 4 }}><i className="fa-solid fa-gavel" style={{ marginRight: 4 }}></i>Appeal Submitted</div>
                    <p style={{ fontSize: 12, margin: 0, color: 'var(--text-primary)' }}>{w.appeal_reason}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%', marginTop: 18 }}>Close</button>
      </div>
    </div>
  );
}

// -- APPEAL MODAL --------------------------------------------------------------
export function AppealModal({ warning, onClose, userId }) {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/moderation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'appeal-warning', warningId: warning.id, userId, appealReason: reason.trim(), evidence: evidence.trim() || null })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to submit appeal'); setSubmitting(false); return; }
      setDone(true);
    } catch { setError('Network error. Please try again.'); setSubmitting(false); }
  };

  const getSeverityColor = (s) => {
    if (s === 'critical') return 'var(--red)';
    if (s === 'severe') return '#ff5555';
    if (s === 'moderate') return 'var(--cyber-yellow)';
    return 'var(--orange)';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-gavel" style={{ fontSize: 36, color: 'var(--cyber-cyan)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--cyber-cyan)', marginBottom: 8 }}>Appeal Submitted</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>A system admin will review your appeal within 24-48 hours.</p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6, color: 'var(--cyber-cyan)' }}><i className="fa-solid fa-gavel" style={{ marginRight: 8 }}></i>Appeal Warning</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Explain why you believe this warning was issued incorrectly.</p>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${getSeverityColor(warning.severity)}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: getSeverityColor(warning.severity), textTransform: 'uppercase', letterSpacing: 1 }}>{warning.severity} WARNING</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', marginLeft: 'auto' }}>-{warning.points_deducted} pts</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 0' }}>{warning.reason}</p>
            </div>
            <div className="input-group">
              <label>YOUR APPEAL (REQUIRED)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this warning should be overturned." style={{ width: '100%', minHeight: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} maxLength={500} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{reason.length}/500</div>
            </div>
            <div className="input-group">
              <label>EVIDENCE (OPTIONAL)</label>
              <textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Provide any additional context or proof." style={{ width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} maxLength={500} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{evidence.length}/500</div>
            </div>
            <div style={{ background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--cyber-cyan)' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>If your appeal is approved, the points will be restored plus a +1 bonus.
            </div>
            {error && <div style={{ background: 'rgba(247,95,95,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>{error}</div>}
            <div className="modal-actions">
              <button className="cyber-btn" onClick={submit} disabled={submitting || !reason.trim()} style={{ flex: 1 }}>{submitting ? 'Submitting...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Submit Appeal</>}</button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
