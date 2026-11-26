import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  ParticipantTile,
  useLocalParticipant,
  useConnectionState,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';

// Overlay shown while LiveKit room is still connecting
function CallConnectingOverlay({ circleName }) {
  const connectionState = useConnectionState();
  if (connectionState === ConnectionState.Connected) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: '#0d0d12',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(62,207,142,0.12)', border: '2px solid #3ecf8e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: '#3ecf8e',
      }}>
        <i className="fa-solid fa-phone fa-beat"></i>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
        {connectionState === ConnectionState.Reconnecting ? 'Reconnecting...' : `Joining ${circleName} call...`}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
        Connecting to voice & video
      </div>
    </div>
  );
}

// Keeps track of current participant count so leaving knows if you're the last one
function ParticipantCountTracker({ countRef }) {
  const participants = useParticipants();
  useEffect(() => {
    countRef.current = participants.length;
  }, [participants.length, countRef]);
  return null;
}

// Raise hand button — overlays on top of the control bar
function RaiseHandButton({ isMobile = false, communityId, supabase, currentUser }) {
  const { localParticipant } = useLocalParticipant();
  const [raised, setRaised] = useState(false);

  const toggleHand = useCallback(async () => {
    const next = !raised;
    setRaised(next);
    try {
      await localParticipant.setMetadata(JSON.stringify({ handRaised: next }));
      // Post system message when raising hand
      if (next && supabase && communityId) {
        const name = currentUser?.full_name || localParticipant.name || 'Someone';
        await supabase.from('messages').insert([{
          content: `NEXOSYS:✋ ${name} raised their hand`,
          message_type: 'text',
          community_id: communityId,
          channel_id: null,
          sender_id: null,
        }]);
      }
    } catch { /* non-fatal */ }
  }, [raised, localParticipant, supabase, communityId, currentUser]);

  return (
    <button
      onClick={toggleHand}
      title={raised ? 'Lower hand' : 'Raise hand'}
      style={{
        background: raised ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${raised ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 8,
        color: raised ? '#fbbf24' : 'rgba(255,255,255,0.7)',
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: isMobile ? 15 : 12,
        fontFamily: 'inherit',
        fontWeight: raised ? 700 : 400,
        display: 'flex', alignItems: 'center', gap: 5,
        transition: '0.2s',
      }}>
      <span>✋</span>
      {!isMobile && (raised ? 'Lower Hand' : 'Raise Hand')}
    </button>
  );
}

// Hand raised indicator — shows toast when others raise hand
function HandRaisedWatcher() {
  const participants = useParticipants();
  const raisedNames = participants
    .filter(p => { try { return JSON.parse(p.metadata || '{}').handRaised; } catch { return false; } })
    .map(p => p.name || 'Someone');

  if (raisedNames.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 56, right: 16, zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {raisedNames.map((name, i) => (
        <div key={i} style={{
          background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
          borderRadius: 10, padding: '6px 12px', fontSize: 12,
          color: '#fbbf24', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>✋</span> {name} raised hand
        </div>
      ))}
    </div>
  );
}

// Pip content — rendered inside the single LiveKitRoom
function PipContent({ circleName, onMaximize, onLeave }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false }
  );
  const activeTrack = tracks.find(t => !t.participant?.isLocal) || tracks[0];

  // Draggable state
  const [pos, setPos] = useState({ x: window.innerWidth - 300, y: window.innerHeight - 220 });
  const dragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    dragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
    e.preventDefault();
  };
  React.useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPos({
        x: Math.min(Math.max(0, clientX - offset.current.x), window.innerWidth - 280),
        y: Math.min(Math.max(0, clientY - offset.current.y), window.innerHeight - 180),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
      background: 'rgba(13,13,18,0.96)',
      border: '1px solid rgba(62,207,142,0.35)',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(12px)',
      width: Math.min(280, window.innerWidth - 20),
      userSelect: 'none',
    }}>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onMouseDown}
        style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <i className="fa-solid fa-grip-lines" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}></i>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>drag to move</span>
      </div>
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

export default function CallModal({ token, livekitUrl, circleName, currentUser, communityId, supabase, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const participantCountRef = useRef(1);
  const closedRef = useRef(false);

  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose(participantCountRef.current <= 1);
  }, [onClose]);

  return (
    // ONE single LiveKitRoom — never unmounts, keeps connection alive
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      video={false}
      audio={false}
      onDisconnected={handleClose}
      style={{ display: 'contents' }}
    >
      <RoomAudioRenderer />
      <ParticipantCountTracker countRef={participantCountRef} />

      {/* Full modal — hidden via CSS when minimized, NOT unmounted */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)',
        display: minimized ? 'none' : 'flex',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: minimized ? 'none' : 'all',
      }}>
        <div style={{
          width: '94%', maxWidth: 980,
          background: '#0d0d12',
          border: '1px solid rgba(0,240,255,0.12)',
          borderRadius: window.innerWidth < 640 ? 0 : 16,
          overflow: 'hidden',
          height: window.innerWidth < 640 ? '100dvh' : window.innerHeight < 700 ? '95vh' : '86vh',
          boxShadow: '0 0 60px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          width: window.innerWidth < 640 ? '100%' : '94%',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e', marginRight: 10, flexShrink: 0 }}></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{circleName} — Voice/Video Call</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <RaiseHandButton isMobile={window.innerWidth < 640} communityId={communityId} supabase={supabase} currentUser={currentUser} />
              <button onClick={() => setMinimized(true)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.7)', padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fa-solid fa-minus"></i>
                {window.innerWidth >= 640 && <span>Minimize</span>}
              </button>
            </div>
          </div>

          {/* VideoConference */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <VideoConference style={{ height: '100%', '--lk-bg': '#0d0d12' }} />
            <style>{`
              .lk-chat-toggle, [data-lk-source="chat"], .lk-chat-container { display: none !important; }
              .lk-focus-toggle-button { display: none !important; }
              .lk-participant-tile { border-radius: 10px; }
            `}</style>
            <HandRaisedWatcher />
            <CallConnectingOverlay circleName={circleName} />
          </div>
        </div>
      </div>

      {/* Minimized pip — only shown when minimized */}
      {minimized && (
        <PipContent
          circleName={circleName}
          onMaximize={() => setMinimized(false)}
          onLeave={handleClose}
        />
      )}
    </LiveKitRoom>
  );
}
