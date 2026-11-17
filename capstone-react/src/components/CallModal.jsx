import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function CallModal({ roomUrl, circleName, currentUser, onClose }) {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState(null);

  const handleClose = useCallback(() => {
    if (frameRef.current) {
      try { frameRef.current.leave(); } catch {}
      try { frameRef.current.destroy(); } catch {}
      frameRef.current = null;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return;

    // Dynamically load daily-js from CDN to avoid build issues
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@daily-co/daily-js';
    script.async = true;
    script.onload = () => {
      const frame = window.DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      });

      frameRef.current = frame;

      frame
        .on('joined-meeting', () => setJoined(true))
        .on('participant-updated', () => setParticipantCount(Object.keys(frame.participants()).length))
        .on('participant-joined', () => setParticipantCount(Object.keys(frame.participants()).length))
        .on('participant-left', () => setParticipantCount(Object.keys(frame.participants()).length))
        .on('error', (e) => setError(e?.errorMsg || 'Call error occurred'))
        .on('left-meeting', handleClose);

      frame.join({ url: roomUrl, userName: currentUser?.full_name || 'User' });
    };
    document.head.appendChild(script);

    return () => {
      if (frameRef.current) {
        try { frameRef.current.destroy(); } catch {}
        frameRef.current = null;
      }
      // Remove script tag
      const existing = document.querySelector('script[src*="daily-js"]');
      if (existing) existing.remove();
    };
  }, [roomUrl]);

  const toggleMute = () => {
    if (!frameRef.current) return;
    frameRef.current.setLocalAudio(isMuted);
    setIsMuted(v => !v);
  };

  const toggleCam = () => {
    if (!frameRef.current) return;
    frameRef.current.setLocalVideo(isCamOff);
    setIsCamOff(v => !v);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '92%', maxWidth: 880,
        background: 'var(--bg-primary)',
        border: '1px solid rgba(0,240,255,0.2)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 40px rgba(0,240,255,0.1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: joined ? '#3ecf8e' : '#f59e0b' }}></div>
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

        {error && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>{error}
          </div>
        )}

        {/* Video container */}
        <div ref={containerRef} style={{ width: '100%', height: 460, background: '#000' }} />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={toggleMute}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMuted ? 'rgba(247,95,95,0.2)' : 'rgba(255,255,255,0.08)', color: isMuted ? 'var(--red)' : 'var(--text-primary)' }}
            title={isMuted ? 'Unmute' : 'Mute'}>
            <i className={isMuted ? 'fa-solid fa-microphone-slash' : 'fa-solid fa-microphone'} />
          </button>
          <button onClick={toggleCam}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCamOff ? 'rgba(247,95,95,0.2)' : 'rgba(255,255,255,0.08)', color: isCamOff ? 'var(--red)' : 'var(--text-primary)' }}
            title={isCamOff ? 'Turn on camera' : 'Turn off camera'}>
            <i className={isCamOff ? 'fa-solid fa-video-slash' : 'fa-solid fa-video'} />
          </button>
          <button onClick={handleClose}
            style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--red)', color: '#fff' }}
            title="Leave call">
            <i className="fa-solid fa-phone-slash" />
          </button>
        </div>
      </div>
    </div>
  );
}
