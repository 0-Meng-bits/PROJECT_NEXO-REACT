import React, { useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  ParticipantTile,
  ControlBar,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// Minimized pip — stays connected, shows thumbnail
function MinimizedPip({ circleName, onMaximize, onLeave }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false }
  );
  const activeTrack = tracks.find(t => !t.participant?.isLocal) || tracks[0];

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'rgba(13,13,18,0.96)',
      border: '1px solid rgba(62,207,142,0.35)',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(12px)',
      width: 280,
    }}>
      {/* Thumbnail */}
      {activeTrack ? (
        <div style={{ height: 130, background: '#000', overflow: 'hidden' }}>
          <ParticipantTile trackRef={activeTrack} style={{ width: '100%', height: '100%' }} />
        </div>
      ) : (
        <div style={{ height: 80, background: 'rgba(0,240,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {participants.slice(0, 4).map((p, i) => (
            <div key={p.sid} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '2px solid #0d0d12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#00f0ff' }}>
              {(p.name || '?')[0].toUpperCase()}
            </div>
          ))}
        </div>
      )}
      {/* Controls */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{circleName}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ecf8e', display: 'inline-block' }}></span>
            {participants.length} in call
          </div>
        </div>
        <button onClick={onMaximize}
          style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 8, color: '#00f0ff', padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          <i className="fa-solid fa-expand"></i>
        </button>
        <button onClick={onLeave}
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          <i className="fa-solid fa-phone-slash"></i>
        </button>
      </div>
    </div>
  );
}

function MinimizedWrapper({ circleName, onMaximize, onLeave }) {
  return (
    <>
      <RoomAudioRenderer />
      <MinimizedPip circleName={circleName} onMaximize={onMaximize} onLeave={onLeave} />
    </>
  );
}

// Main export
export default function CallModal({ token, livekitUrl, circleName, onClose }) {
  const [minimized, setMinimized] = useState(false);

  return (
    <>
      {/* Full modal — uses VideoConference for device dropdowns */}
      {!minimized && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '94%', maxWidth: 980,
            background: '#0d0d12',
            border: '1px solid rgba(0,240,255,0.12)',
            borderRadius: 16, overflow: 'hidden',
            height: '86vh',
            boxShadow: '0 0 60px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Custom header with minimize */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e', marginRight: 10 }}></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{circleName} — Voice/Video Call</span>
              <button onClick={() => setMinimized(true)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.7)', padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-minus"></i> Minimize
              </button>
            </div>

            {/* LiveKit VideoConference — keeps device dropdowns + all controls */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <LiveKitRoom
                token={token}
                serverUrl={livekitUrl}
                connect={true}
                video={true}
                audio={true}
                onDisconnected={onClose}
                style={{ height: '100%' }}
              >
                <VideoConference
                  chatMessageFormatter={undefined}
                  style={{ height: '100%', '--lk-bg': '#0d0d12' }}
                />
                <RoomAudioRenderer />
              </LiveKitRoom>
            </div>
          </div>
        </div>
      )}

      {/* Minimized pip */}
      {minimized && (
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          video={false}
          audio={true}
          onDisconnected={onClose}
          style={{ display: 'none' }}
        >
          <MinimizedWrapper
            circleName={circleName}
            onMaximize={() => setMinimized(false)}
            onLeave={onClose}
          />
        </LiveKitRoom>
      )}
    </>
  );
}
