import React from 'react';

// -- ONLINE USERS STACK -------------------------------------------------------
// Renders a stack of overlapping avatar circles for online users.
// Circle mates appear first in the stack.
export default function OnlineStack({ onlineProfiles, circleMateIds, avatarCache, maxShow = 5, onClick }) {
  if (!onlineProfiles.length) return null;

  // Sort: circle mates first, then others
  const sorted = [...onlineProfiles].sort((a, b) => {
    const aIsMate = circleMateIds.has(a.id);
    const bIsMate = circleMateIds.has(b.id);
    return bIsMate - aIsMate;
  });

  const shown = sorted.slice(0, maxShow);
  const rest = onlineProfiles.length - shown.length;

  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? 'See who\'s online' : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((p, i) => {
          const url = avatarCache[p.student_id] || p.avatar_url;
          const initials = (p.full_name || '?')[0].toUpperCase();
          return (
            <div key={p.id} title={p.full_name}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '2px solid var(--card-bg)',
                background: url ? 'transparent' : 'rgba(0,240,255,0.15)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--cyber-cyan)',
                marginLeft: i === 0 ? 0 : -8,
                zIndex: maxShow - i,
                position: 'relative',
                flexShrink: 0,
              }}>
              {url
                ? <img src={url} alt={p.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
          );
        })}
        {rest > 0 && (
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '2px solid var(--card-bg)',
            background: 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
            marginLeft: -8, position: 'relative', zIndex: 0, flexShrink: 0,
          }}>
            +{rest}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ecf8e', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {onlineProfiles.length} online
        </span>
      </div>
    </div>
  );
}
