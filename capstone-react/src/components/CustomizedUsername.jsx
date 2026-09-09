// Component to display username with customizations (badge, color)
import { useState, useEffect } from 'react';
import { getUserBadge, getUserNameStyle } from '../lib/customization';

// Simple cache to avoid repeated lookups
const customsCache = new Map();

export default function CustomizedUsername({ userId, studentId, username, style = {}, customizations }) {
  const [customs, setCustoms] = useState(customizations || null);
  const [loading, setLoading] = useState(!customizations);

  useEffect(() => {
    // If customizations were passed in, use them
    if (customizations) {
      setCustoms(customizations);
      setLoading(false);
      return;
    }

    // For now, just show plain username to avoid CORS issues
    // Full implementation would require passing customizations from parent
    setLoading(false);
  }, [userId, studentId, customizations]);

  if (loading) {
    return <span style={style}>{username}</span>;
  }

  const badge = getUserBadge(customs);
  const nameStyle = getUserNameStyle(customs);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      <span style={nameStyle}>{username}</span>
      {badge && (
        <span style={{ fontSize: '0.85em' }} title="Profile Badge">
          {badge}
        </span>
      )}
    </span>
  );
}
