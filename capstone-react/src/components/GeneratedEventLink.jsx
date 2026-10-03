import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function GeneratedEventLink({ eventId, eventTitle, isAdmin, onViewEvents }) {
  const navigate = useNavigate();

  if (!eventId) return null;

  const handleClick = (e) => {
    e.preventDefault();
    if (isAdmin) {
      navigate('/admin');
    } else if (onViewEvents) {
      onViewEvents();
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
        {isAdmin ? 'Go to Admin Dashboard' : 'View Events'} <i className="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  );
}
