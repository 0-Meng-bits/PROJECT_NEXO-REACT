import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function GeneratedEventLink({ eventId, eventTitle, isAdmin }) {
  const navigate = useNavigate();
  
  if (!eventId) return null;

  const handleClick = (e) => {
    e.preventDefault();
    
    if (isAdmin) {
      // Navigate to admin dashboard where they can view campus events
      navigate('/admin');
      // Show helpful message
      setTimeout(() => {
        alert(`Event created successfully!\n\nYou can view this event in the "Campus Events" section of the Admin Dashboard.`);
      }, 100);
    } else {
      // Regular users: show informative message
      alert(`Event created successfully!\n\nClick the date/time in the navigation bar to view this event and other upcoming events from your circles.`);
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
        {isAdmin ? 'Go to Admin Dashboard' : 'View Details'} <i className="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  );
}
