import React, { useState, useEffect, useCallback } from 'react';
import DailyIframe from '@daily-co/daily-js';

export default function CallModal({ roomUrl, circleName, currentUser, onClose }) {
  const [callFrame, setCallFrame] = useState(null);
  const [participants, setParticipants] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = React.useRef(null);

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return;

    const frame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '12px',
      },
      showLeaveButton: false,
      showFullscreenButton: true,
    });

    frame
      .on('joined-meeting', () => setJoined(true))
      .on('participant-updated', () => setParticipants({ ...frame.participants() }))
      .on('participant-joined', () => setParticipants({ ...frame.participants() }))
      .on('participant-left', () => setParticipants({ ...frame.participants() }))
      .on('error', (e) => setError(e?.errorMsg || 'Call error'))
      .on('left-meeting', () => { handleClose(frame); });

    frame.join({
      url: roomUrl,
      userName: currentUser?.full_name || 'User',
    });

    setCallFrame(frame);

    return () => {
      frame.destroy();
    };
  }, [roomUrl]);

  const handleClose = useCallback((frame) => {
    const f = frame || callFrame;
    if (f) {
      try { f.leave(); } catch { /* already left */ }
      try { f.destroy(); } catch { /* already destroyed */ }
    }
    onClose();
  }, [callFrame, onClose]);

  const toggleMute = () => {
    if (!callFrame) return;
    callFrame.setLocalAudio(isMuted);
    setIsMuted(v => !v);
  };

  const toggleCam = () => {
    if (!callFrame) return;
    callFrame.setLocalVideo(isCamOff);
    setIsCamOff(v => !v);
  };

  const participantCount = Object.keys(participants).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '90%', maxWidth: 860, background: 'var(--bg-primary)',
        border: '1px solid rgba(0,240,255,0.2)', borderRadius: 16,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 40px rgba(0,240,255,0.1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: joined ? '#3ecf8e' : '#f59e0b', animation: joined ? 'none' : 'pulse 1.5s infinite' }}></div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {joined ? `${circleName} — Voice/Video Call` : 'Connecting...'}
            </span>
            {joined && participantCount > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
                <i className="fa-solid fa-users" style={{ marginRight: 5, fontSize: 9 }}></i>{participantCount} in call
              </span>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>{error}
          </div>
        )}

        {/* Daily iframe container */}
        <div ref={containerRef} style={{ width: '100%', height: 460, background: '#000' }} />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={toggleMute}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMuted ? 'rgba(247,95,95,0.2)' : 'rgba(255,255,255,0.08)', color: isMuted ? 'var(--red)' : 'var(--text-primary)', transition: '0.2s' }}
            title={isMuted ? 'Unmute' : 'Mute'}>
            <i className={isMuted ? 'fa-solid fa-microphone-slash' : 'fa-solid fa-microphone'} />
          </button>
          <button onClick={toggleCam}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCamOff ? 'rgba(247,95,95,0.2)' : 'rgba(255,255,255,0.08)', color: isCamOff ? 'var(--red)' : 'var(--text-primary)', transition: '0.2s' }}
            title={isCamOff ? 'Turn on camera' : 'Turn off camera'}>
            <i className={isCamOff ? 'fa-solid fa-video-slash' : 'fa-solid fa-video'} />
          </button>
          <button onClick={() => handleClose(null)}
            style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--red)', color: '#fff', transition: '0.2s' }}
            title="Leave call">
            <i className="fa-solid fa-phone-slash" />
          </button>
        </div>
      </div>
    </div>
  );
}
