import React from 'react';
import { ApplicationStatusColor, ApplicationStatusLabel } from './ApplicationSystem';

// -- APPLICATION DETAIL MODAL -------------------------------------------------
// Read-only view of a submitted circle application.
// data = { response, community, questions }
export default function ApplicationDetailModal({ data, onClose }) {
  const { response: r, community: c, questions } = data;
  const statusColor = ApplicationStatusColor(r.status, r.phase2_result);
  const statusLabel = ApplicationStatusLabel(r.status, r.phase2_result);

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
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{r.phase2_details}</p>
          </div>
        )}

        {/* Leader feedback */}
        {r.feedback && (
          <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              <i className="fa-solid fa-comment" style={{ marginRight: 6 }}></i>FEEDBACK FROM LEADER
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{r.feedback}</p>
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
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>
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
