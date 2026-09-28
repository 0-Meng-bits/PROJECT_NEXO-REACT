import React from 'react';

export default function EventCard({ event, showCircleName = false }) {
  const categoryColors = {
    academic: '#3b82f6',
    social: '#ec4899',
    sports: '#10b981',
    cultural: '#f59e0b',
    general: '#6b7280',
  };
  
  const color = categoryColors[event.category] || categoryColors.general;
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString([], { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatTime = (time) => {
    if (!time) return '';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="event-card">
      <span 
        className="event-category-badge"
        style={{ 
          backgroundColor: `${color}20`,
          border: `1px solid ${color}`,
          color: color
        }}
      >
        {event.category}
      </span>
      
      {showCircleName && event.communities && (
        <div className="event-circle-name">
          <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 6 }}></i>
          {event.communities.name}
        </div>
      )}
      
      <h4 className="event-title">{event.title}</h4>
      
      <div className="event-details">
        <div className="event-detail-row">
          <i className="fa-solid fa-calendar"></i>
          <span>{formatDate(event.start_date)}</span>
        </div>
        
        {event.start_time && (
          <div className="event-detail-row">
            <i className="fa-solid fa-clock"></i>
            <span>{formatTime(event.start_time)}</span>
          </div>
        )}
        
        {event.location && (
          <div className="event-detail-row">
            <i className="fa-solid fa-location-dot"></i>
            <span>{event.location}</span>
          </div>
        )}
      </div>
      
      {event.description && (
        <p className="event-description">{event.description}</p>
      )}
    </div>
  );
}
