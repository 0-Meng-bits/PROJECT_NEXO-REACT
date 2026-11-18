import React, { useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  ParticipantTile,
  TrackToggle,
  DisconnectButton,
  ConnectionStateToast,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// --- Custom video grid ---
function CallGrid({ circleName, onMinimize, onLeave }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const count = participants.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e' }}></div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{circleName} — Voice/Video Call</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 20 }}>
            <i className="fa-solid fa-users" style={{ marginRight: 5, fontSize: 9 }}></i>{count}
          </span>
        </div>
        <button onClick={onMinimize}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.7)', padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fa-solid fa-minus"></i> Minimize
        </button>
      </div>

      {/* Video grid */}
      <div style={{
        flex: 1, overflow: 'hidden', padding: 10,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
      }}>
        {tracks.length > 0 ? tracks.map((track) => (
          <ParticipantTile
            key={track.participant.sid + (track.source || '')}
            trackRef={track}
            style={{ borderRadius: 10, overflow: 'hidden', background: '#111' }}
          />
        )) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            <i className="fa-solid fa-video-slash" style={{ marginRight: 8 }}></i>No video
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {/* Mic toggle */}
        <TrackToggle source={Track.Source.Microphone} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fa-solid fa-microphone" />
        </TrackToggle>
        {/* Camera toggle */}
        <TrackToggle source={Track.Source.Camera} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fa-solid fa-video" />
        </TrackToggle>
        {/* Screen share toggle */}
        <TrackToggle source={Track.Source.ScreenShare} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fa-solid fa-display" />
        </TrackToggle>
        {/* Leave */}
        <DisconnectButton style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#ef4444', color: '#fff', fontSize: 17,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fa-solid fa-phone-slash" />
        </DisconnectButton>
      </div>
    </div>
  );
}

// --- Minimized pip bar ---
function MinimizedBar({ circleName, participantCount, onMaximize, onLeave }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'rgba(13,13,18,0.95)', border: '1px solid rgba(62,207,142,0.4)',
      borderRadius: 14, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e', flexShrink: 0 }}></div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{circleName}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          <i className="fa-solid fa-users" style={{ marginRight: 4, fontSize: 9 }}></i>{participantCount} in call
        </div>
      </div>
      <button onClick={onMaximize}
        style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 8, color: 'var(--cyber-cyan)', padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
        <i className="fa-solid fa-expand" style={{ marginRight: 4 }}></i>Open
      </button>
      <button onClick={onLeave}
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
        <i className="fa-solid fa-phone-slash" style={{ marginRight: 4 }}></i>Leave
      </button>
    </div>
  );
}

function MinimizedParticipantCount({ onLeave, onMaximize, circleName }) {
  const participants = useParticipants();
  return (
    <MinimizedBar
      circleName={circleName}
      participantCount={participants.length}
      onMaximize={onMaximize}
      onLeave={onLeave}
    />
  );
}

// --- Main export ---
export default function CallModal({ token, livekitUrl, circleName, onClose }) {
  const [minimized, setMinimized] = useState(false);

  return (
    <>
      {/* Full modal */}
      {!minimized && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '92%', maxWidth: 920,
            background: '#0a0a0f',
            border: '1px solid rgba(0,240,255,0.15)',
            borderRadius: 16, overflow: 'hidden',
            height: '82vh',
            boxShadow: '0 0 60px rgba(0,0,0,0.6)',
          }}>
            <LiveKitRoom
              token={token}
              serverUrl={livekitUrl}
              connect={true}
              video={true}
              audio={true}
              onDisconnected={onClose}
              style={{ height: '100%' }}
            >
              <CallGrid
                circleName={circleName}
                onMinimize={() => setMinimized(true)}
                onLeave={onClose}
              />
              <RoomAudioRenderer />
              <ConnectionStateToast />
            </LiveKitRoom>
          </div>
        </div>
      )}

      {/* Minimized pip — stays in LiveKitRoom context */}
      {minimized && (
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          video={false}
          audio={true}
          onDisconnected={onClose}
        >
          <RoomAudioRenderer />
          <MinimizedParticipantCount
            circleName={circleName}
            onMaximize={() => setMinimized(false)}
            onLeave={onClose}
          />
        </LiveKitRoom>
      )}
    </>
  );
}
