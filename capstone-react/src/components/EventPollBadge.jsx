import React from 'react';

export default function EventPollBadge({ eventDate, eventTime, location }) {
  if (!eventDate || !eventTime || !location) return null;

  // Format date for display
  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="event-poll-badge">
      <div className="event-poll-badge-header">
        <i className="fa-solid fa-calendar-check"></i>
        EVENT POLL
      </div>
      <div className="event-poll-badge-details">
        <div className="event-poll-badge-row">
          <i className="fa-solid fa-calendar"></i>
          <span>{formattedDate}</span>
        </div>
        <div className="event-poll-badge-row">
          <i className="fa-solid fa-clock"></i>
          <span>{eventTime}</span>
        </div>
        <div className="event-poll-badge-row">
          <i className="fa-solid fa-location-dot"></i>
          <span>{location}</span>
        </div>
      </div>
    </div>
  );
}
