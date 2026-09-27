import React, { useState } from 'react';

export default function PollEventMetadataForm({ communityCategory, onChange }) {
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');

  // Only render for social communities
  if (communityCategory !== 'social') {
    return null;
  }

  const handleChange = () => {
    // If any field has a value, return metadata object; otherwise return null
    if (eventDate || eventTime || location) {
      onChange({
        event_date: eventDate || undefined,
        event_time: eventTime || undefined,
        location: location || undefined
      });
    } else {
      onChange(null);
    }
  };

  const handleDateChange = (e) => {
    setEventDate(e.target.value);
    setTimeout(handleChange, 0);
  };

  const handleTimeChange = (e) => {
    setEventTime(e.target.value);
    setTimeout(handleChange, 0);
  };

  const handleLocationChange = (e) => {
    setLocation(e.target.value);
    setTimeout(handleChange, 0);
  };

  return (
    <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="fa-solid fa-calendar-plus"></i>
        EVENT DETAILS (OPTIONAL)
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
        Add event details to automatically create a calendar event when the poll closes
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Event Date */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
            Event Date
          </label>
          <input
            type="date"
            value={eventDate}
            onChange={handleDateChange}
            min={new Date().toISOString().split('T')[0]}
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}
          />
        </div>

        {/* Event Time */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
            Event Time (24-hour format)
          </label>
          <input
            type="time"
            value={eventTime}
            onChange={handleTimeChange}
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}
          />
        </div>

        {/* Location */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Location</span>
            <span style={{ color: location.length > 200 ? 'var(--red)' : 'var(--text-muted)', fontSize: 10 }}>
              {location.length}/200
            </span>
          </label>
          <input
            type="text"
            value={location}
            onChange={handleLocationChange}
            maxLength={200}
            placeholder="e.g., CTU Gymnasium, Room 304"
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${location.length > 200 ? 'var(--red)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
}
