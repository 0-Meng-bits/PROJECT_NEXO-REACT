import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// -- REPORT MODAL -------------------------------------------------------------
// Generic report submission modal. Adapts its title and reason list based on
// data.type: 'profile_photo' | 'circle_photo' | 'user' | 'message' | 'circle' | post types
export default function ReportModal({ data, user, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Context-aware title and reasons based on report type
  const isPhoto = data.type === 'profile_photo' || data.type === 'circle_photo';
  const isUser = data.type === 'user';
  const isMessage = data.type === 'message';
  const isCircle = data.type === 'circle';

  const TITLE = isPhoto ? 'Report Photo' : isUser ? 'Report User' : isCircle ? 'Report Circle' : isMessage ? 'Report Message' : 'Report Post';

  const REASONS = isPhoto ? [
    'Inappropriate or explicit content',
    'Impersonation / fake identity',
    'Offensive or disturbing imagery',
    'Spam or fake profile photo',
    'Other',
  ] : isUser ? [
    'Harassment or bullying',
    'Fake or impersonation account',
    'Spam behavior',
    'Inappropriate conduct',
    'Other',
  ] : isCircle ? [
    'Harmful or dangerous content',
    'Spam or misleading circle',
    'Hate speech or discrimination',
    'Impersonation of a real organization',
    'Inappropriate circle name or description',
    'Other',
  ] : [
    'Inappropriate language / profanity',
    'Harassment or bullying',
    'Spam or irrelevant content',
    'Misinformation',
    'Hate speech or discrimination',
    'Other',
  ];

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    await supabase.from('reports').insert([{
      reporter_id: user.id,
      reported_user_id: data.reportedUserId || null,
      content_type: data.type,
      content_id: data.id,
      content_preview: data.preview?.slice(0, 200),
      reason,
      status: 'pending',
    }]);
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 36, color: 'var(--green)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--green)', marginBottom: 8 }}>Report Submitted</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Thank you. The admin will review this report.
            </p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6 }}>
              <i className="fa-solid fa-flag" style={{ marginRight: 8, color: 'var(--red)' }}></i>
              {TITLE}
            </h3>
            {data.preview && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontStyle: 'italic' }}>
                "{data.preview.slice(0, 120)}{data.preview.length > 120 ? '...' : ''}"
              </div>
            )}
            <div className="input-group">
              <label>REASON FOR REPORT</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REASONS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, width: '100%', boxSizing: 'border-box', color: reason === r ? 'var(--text-primary)' : 'var(--text-muted)', padding: '9px 12px', borderRadius: 8, border: `1px solid ${reason === r ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.08)'}`, background: reason === r ? 'rgba(0,240,255,0.06)' : 'transparent', transition: '0.15s' }}>
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: 'var(--cyber-cyan)', flexShrink: 0, width: 16, height: 16 }} />
                    <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>{r}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="cyber-btn" onClick={submit} disabled={submitting || !reason}
                style={{ flex: 1, background: 'rgba(247,95,95,0.15)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                {submitting ? 'Submitting...' : <><i className="fa-solid fa-flag" style={{ marginRight: 6 }}></i>Submit Report</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
