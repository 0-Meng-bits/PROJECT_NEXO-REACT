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
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// --- Controls bar ---
function ControlBar({ onMinimize, onLeave }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '14px 20px',
      borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      background: '#0d0d12',
    }}>
      {/* Mic */}
      <div style={{ position: 'relative' }}>
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={true}
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            cursor: 'pointer', color: '#fff', fontSize: 16,
          }}
        />
      </div>

      {/* Camera — with device selector dropdown above */}
      <div style={{ position: 'relative' }}>
        <TrackToggle
          source={Track.Source.Camera}
          showIcon={true}
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            cursor: 'pointer', color: '#fff', fontSize: 16,
          }}
        />
      </div>

      {/* Screen share */}
      <div style={{ position: 'relative' }}>
        <TrackToggle
          source={Track.Source.ScreenShare}
          showIcon={true}
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            cursor: 'pointer', color: '#fff', fontSize: 15,
          }}
        />
      </div>

      {/* Minimize */}
      <button onClick={onMinimize}
        style={{
          width: 46, height: 46, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', border: 'none',
          cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Minimize">
        <i className="fa-solid fa-minus" />
      </button>

      {/* Leave */}
      <DisconnectButton style={{
        width: 54, height: 54, borderRadius: '50%',
        background: '#ef4444', border: 'none',
        cursor: 'pointer', color: '#fff', fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className="fa-solid fa-phone-slash" />
      </DisconnectButton>
    </div>
  );
}

// --- Video grid ---
function CallGrid({ circleName, onMinimize }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const count = tracks.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e' }}></div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{circleName} — Voice/Video Call</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '2px 10px', borderRadius: 20 }}>
          <i className="fa-solid fa-users" style={{ marginRight: 5, fontSize: 9 }}></i>{participants.length}
        </span>
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, padding: 12, overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: '1fr',
        gap: 10,
      }}>
        {tracks.length > 0 ? tracks.map((track, i) => (
          <ParticipantTile
            key={track.participant?.sid + i}
            trackRef={track}
            style={{ borderRadius: 12, overflow: 'hidden' }}
          />
        )) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', gap: 10, fontSize: 13 }}>
            <i className="fa-solid fa-video-slash" style={{ fontSize: 28 }}></i>
            Waiting for video...
          </div>
        )}
      </div>

      <ControlBar onMinimize={onMinimize} />
    </div>
  );
}

// --- Minimized pip ---
function MinimizedPip({ circleName, onMaximize, onLeave }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false }
  );

  // Get first active video track for thumbnail
  const activeTrack = tracks.find(t => !t.participant?.isLocal && t.publication?.isSubscribed) || tracks[0];

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
      {/* Mini video thumbnail */}
      {activeTrack ? (
        <div style={{ height: 130, background: '#000', position: 'relative', overflow: 'hidden' }}>
          <ParticipantTile
            trackRef={activeTrack}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div style={{ height: 80, background: 'rgba(0,240,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: -6 }}>
            {participants.slice(0, 4).map((p, i) => (
              <div key={p.sid} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '2px solid #0d0d12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--cyber-cyan)', marginLeft: i > 0 ? -10 : 0 }}>
                {(p.name || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info + controls */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{circleName}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#3ecf8e', marginRight: 5 }}></span>
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

// --- Main export ---
export default function CallModal({ token, livekitUrl, circleName, onClose }) {
  const [minimized, setMinimized] = useState(false);

  return (
    <>
      {!minimized && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '94%', maxWidth: 960,
            background: '#0d0d12',
            border: '1px solid rgba(0,240,255,0.12)',
            borderRadius: 16, overflow: 'hidden',
            height: '85vh',
            boxShadow: '0 0 60px rgba(0,0,0,0.7)',
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
              <CallGrid circleName={circleName} onMinimize={() => setMinimized(true)} />
              <RoomAudioRenderer />
              <ConnectionStateToast />
            </LiveKitRoom>
          </div>
        </div>
      )}

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
          <RoomAudioRenderer />
          <MinimizedPip
            circleName={circleName}
            onMaximize={() => setMinimized(false)}
            onLeave={onClose}
          />
        </LiveKitRoom>
      )}
    </>
  );
}
