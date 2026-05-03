import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Animated cyber grid background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,240,255,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      // Draw particles
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,240,255,0.5)';
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem('nexo-visited', 'true');
    navigate('/auth');
  };

  const features = [
    {
      icon: 'fa-solid fa-circle-nodes',
      title: 'Connect with Circles',
      desc: 'Join academic groups, hobby clubs, and project teams. Find your people on campus.',
    },
    {
      icon: 'fa-solid fa-microphone',
      title: 'Audition for Organizations',
      desc: 'Apply to exclusive circles through a structured audition process. Show what you\'ve got.',
    },
    {
      icon: 'fa-solid fa-bullhorn',
      title: 'Campus-Wide Feed',
      desc: 'Stay updated with announcements, events, and shoutouts from across the university.',
    },
    {
      icon: 'fa-solid fa-comments',
      title: 'Real-Time Chat',
      desc: 'Communicate instantly with circle members through dedicated channels and group chats.',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-black)',
      color: 'var(--text-primary)',
      fontFamily: "'Outfit', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background canvas */}
      <canvas ref={canvasRef} style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Grid overlay */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* NAV */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(0,240,255,0.1)',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logoo.png" alt="NEXO" style={{ width: 36, height: 'auto', filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.6))' }} />
            <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: 4, color: 'var(--cyber-yellow)' }}>
              NEXO<span style={{ color: 'var(--cyber-cyan)', fontWeight: 300 }}>CONNECT</span>
            </span>
          </div>
          <button
            onClick={handleGetStarted}
            style={{
              background: 'transparent',
              border: '1px solid var(--cyber-cyan)',
              color: 'var(--cyber-cyan)',
              padding: '8px 24px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(0,240,255,0.1)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; }}
          >
            SIGN IN
          </button>
        </nav>

        {/* HERO */}
        <section style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '80vh', textAlign: 'center', padding: '60px 24px',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.25)',
            borderRadius: 20, padding: '6px 18px', marginBottom: 32,
            fontSize: 11, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700,
          }}>
            <i className="fa-solid fa-circle" style={{ fontSize: 6, color: 'var(--green)' }}></i>
            CTU CAMPUS NETWORK — ONLINE
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 7vw, 5rem)',
            fontWeight: 800,
            letterSpacing: 4,
            lineHeight: 1.1,
            marginBottom: 16,
            color: 'var(--cyber-yellow)',
            textShadow: '0 0 40px rgba(252,238,10,0.3)',
          }}>
            NEXO<span style={{ color: 'var(--cyber-cyan)', fontWeight: 300 }}>CONNECT</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
            color: 'var(--text-muted)',
            marginBottom: 12,
            letterSpacing: 2,
            fontWeight: 300,
          }}>
            Your Campus. Your Community.
          </p>

          <p style={{
            fontSize: 14, color: 'var(--text-muted)', maxWidth: 520,
            lineHeight: 1.8, marginBottom: 48,
          }}>
            The official student network of Cebu Technological University. Connect with circles,
            discover organizations, and be part of the campus conversation.
          </p>

          <button
            onClick={handleGetStarted}
            className="cyber-btn"
            style={{
              padding: '16px 48px', fontSize: 14, letterSpacing: 2,
              clipPath: 'polygon(5% 0, 100% 0, 100% 70%, 95% 100%, 0 100%, 0% 30%)',
              borderRadius: 0,
            }}
          >
            <i className="fa-solid fa-rocket" style={{ marginRight: 10 }}></i>
            GET STARTED
          </button>

          <p style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
            CTU students &amp; faculty only · Verified accounts required
          </p>
        </section>

        {/* FEATURES */}
        <section style={{ padding: '60px 48px 80px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: 3, color: 'var(--cyber-cyan)', marginBottom: 12 }}>
              PLATFORM FEATURES
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Everything you need to thrive in your campus community
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
          }}>
            {features.map((f, i) => (
              <div key={i} style={{
                background: 'rgba(15,15,20,0.7)',
                border: '1px solid rgba(0,240,255,0.12)',
                borderRadius: 12,
                padding: 28,
                backdropFilter: 'blur(10px)',
                transition: 'border-color 0.2s, transform 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,240,255,0.4)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,240,255,0.12)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16, fontSize: 20, color: 'var(--cyber-cyan)',
                }}>
                  <i className={f.icon}></i>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: 1 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA FOOTER */}
        <section style={{
          textAlign: 'center', padding: '60px 24px',
          borderTop: '1px solid rgba(0,240,255,0.08)',
          background: 'rgba(0,0,0,0.3)',
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--cyber-yellow)', letterSpacing: 3, marginBottom: 16 }}>
            READY TO CONNECT?
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
            Join thousands of CTU students already on the network.
          </p>
          <button onClick={handleGetStarted} className="cyber-btn" style={{ padding: '14px 40px', fontSize: 13 }}>
            <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: 8 }}></i>
            JOIN THE NETWORK
          </button>
          <p style={{ marginTop: 40, fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>
            © {new Date().getFullYear()} NEXO Connect · Cebu Technological University
          </p>
        </section>
      </div>
    </div>
  );
}
