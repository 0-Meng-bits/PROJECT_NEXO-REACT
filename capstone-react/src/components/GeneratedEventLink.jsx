import React from 'react';

export default function GeneratedEventLink({ eventId, eventTitle, onNavigate }) {
  if (!eventId) return null;

  const handleClick = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(eventId);
    } else {
      // Default: just show alert if no navigation handler provided
      alert(`Event created: ${eventTitle || 'View in Calendar'}`);
    }
  };

  return (
    <div className="generated-event-link">
      <div className="generated-event-link-content">
        <i className="fa-solid fa-calendar-check"></i>
        <div>
          <div className="generated-event-link-label">Event Created</div>
          <div className="generated-event-link-title">{eventTitle || 'Campus Event'}</div>
        </div>
      </div>
      <button onClick={handleClick} className="generated-event-link-button">
        View Event <i className="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  );
}
