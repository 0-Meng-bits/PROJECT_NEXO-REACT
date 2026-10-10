import { NEXO_YOUTUBE_EMBED_URL } from '../lib/constants';

// Reusable video embed — shows "Coming Soon" if no URL is set
export default function VideoEmbed({ style = {} }) {
  if (NEXO_YOUTUBE_EMBED_URL) {
    return (
      <iframe
        src={NEXO_YOUTUBE_EMBED_URL}
        title="NEXO Connect Tutorial"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: 8, display: 'block', ...style }}
      />
    );
  }

  // Coming Soon placeholder
  return (
    <div style={{
      width: '100%', aspectRatio: '16/9', borderRadius: 8,
      background: 'linear-gradient(135deg, #0d0d1a, #0a1628)',
      border: '1px solid rgba(0,240,255,0.2)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, ...style
    }}>
      <i className="fa-brands fa-youtube" style={{ fontSize: 48, color: '#ff0000', opacity: 0.7 }}></i>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--cyber-cyan)', letterSpacing: 2 }}>
        VIDEO COMING SOON
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260 }}>
        A tutorial and promo video for NEXO Connect is on the way.
      </div>
    </div>
  );
}
