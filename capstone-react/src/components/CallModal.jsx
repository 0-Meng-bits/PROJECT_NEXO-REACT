import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';

function ParticipantCount() {
  const participants = useParticipants();
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
      <i className="fa-solid fa-users" style={{ marginRight: 5, fontSize: 9 }}></i>{participants.length} in call
    </span>
  );
}

export default function CallModal({ token, livekitUrl, circleName, onClose }) {
  const [connected, setConnected] = useState(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '92%', maxWidth: 900,
        background: 'var(--bg-primary)',
        border: '1px solid rgba(0,240,255,0.2)',
        borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 40px rgba(0,240,255,0.1)',
        height: '80vh',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? '#3ecf8e' : '#f59e0b' }}></div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {connected ? `${circleName} — Voice/Video Call` : 'Connecting...'}
            </span>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(247,95,95,0.15)', border: '1px solid rgba(247,95,95,0.3)', borderRadius: 8, color: 'var(--red)', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }}>
            <i className="fa-solid fa-phone-slash" style={{ marginRight: 6 }}></i>Leave
          </button>
        </div>

        {/* LiveKit Room */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LiveKitRoom
            token={token}
            serverUrl={livekitUrl}
            connect={true}
            video={true}
            audio={true}
            onConnected={() => setConnected(true)}
            onDisconnected={onClose}
            style={{ height: '100%' }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
}
