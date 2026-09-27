import React, { useState } from 'react';

export default function PollClosureButton({ 
  announcementId, 
  communityId, 
  userRankLevel, 
  hasEventMetadata, 
  isClosed, 
  onPollClosed 
}) {
  const [loading, setLoading] = useState(false);

  // Only show button to community leaders (rank_level > 0)
  if (userRankLevel <= 0) return null;

  // Don't show if already closed
  if (isClosed) return null;

  const handleClosePoll = async () => {
    if (!confirm('Are you sure you want to close this poll? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch('/api/close-poll', {
        method: 'POST',
        headers,
        body: JSON.stringify({ announcementId, communityId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to close poll');
      }

      // Success!
      if (onPollClosed) {
        onPollClosed(data.eventId);
      }

      // Show success message
      const message = data.eventId 
        ? 'Poll closed successfully! Event has been created.' 
        : 'Poll closed successfully!';
      alert(message);

    } catch (error) {
      console.error('Error closing poll:', error);
      alert(error.message || 'Failed to close poll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const buttonText = hasEventMetadata 
    ? 'Close Poll & Create Event' 
    : 'Close Poll';

  const buttonIcon = hasEventMetadata 
    ? 'fa-calendar-plus' 
    : 'fa-lock';

  return (
    <button 
      onClick={handleClosePoll}
      disabled={loading}
      className="poll-closure-button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: hasEventMetadata ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)',
        border: `1px solid ${hasEventMetadata ? '#3b82f6' : '#a855f7'}`,
        color: hasEventMetadata ? '#3b82f6' : '#a855f7',
        borderRadius: 8,
        padding: '9px 18px',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: loading ? 0.6 : 1
      }}
      onMouseEnter={e => {
        if (!loading) {
          e.currentTarget.style.background = hasEventMetadata ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = hasEventMetadata ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)';
      }}>
      <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : buttonIcon}`}></i>
      {loading ? 'Closing...' : buttonText}
    </button>
  );
}
