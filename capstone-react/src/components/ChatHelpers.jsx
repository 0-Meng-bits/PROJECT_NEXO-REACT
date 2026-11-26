import React from 'react';

// -- CHAT TIME SEPARATOR -------------------------------------------------------
export function ChatTimeSeparator({ date }) {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now - d) / 86400000);
  let label;
  if (diffDays === 0) {
    label = 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    label = 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    label = d.toLocaleDateString([], { weekday: 'long' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    label = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
  }
  return (
    <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

// -- UNREAD DIVIDER -----------------------------------------------------------
export function UnreadDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(247,95,95,0.4)' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: 1, whiteSpace: 'nowrap' }}>
        NEW MESSAGES
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(247,95,95,0.4)' }} />
    </div>
  );
}
