import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadTheme } from '../lib/theme';

// Hook — triggers when element enters viewport
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// Animated section wrapper
function Reveal({ children, delay = 0, className = '', style = {} }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(52px)',
        transition: `opacity 1s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 1s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function Landing({ onEnter }) {
  const [pulse, setPulse] = useState({ online: 0, connections: 0 });
  const [visible, setVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    loadTheme();
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const fetchPulse = async () => {
      const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      setPulse({ online: total || 0, connections: todayCount || 0 });
    };
    fetchPulse();
  }, []);

  const scrollTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const navHeight = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const features = [
    { icon: 'fa-solid fa-users',      title: 'Campus Circles',     desc: 'Join student-led groups, clubs, and organizations across CTU.' },
    { icon: 'fa-solid fa-bullhorn',   title: 'Live Announcements', desc: 'Real-time campus news, events, and notices from faculty and orgs.' },
    { icon: 'fa-solid fa-comments',   title: 'Group Messaging',    desc: 'Chat with classmates in dedicated channels. Collaborate and stay in sync.' },
    { icon: 'fa-solid fa-microphone', title: 'Audition System',    desc: 'Organizations post auditions and accept applications directly.' },
    { icon: 'fa-solid fa-id-card',    title: 'Verified Identity',  desc: 'Every account is verified using your CTU school ID.' },
    { icon: 'fa-solid fa-chart-bar',  title: 'Admin Dashboard',    desc: 'Powerful tools to manage students, verifications, and activity.' },
  ];

  return (
    <div ref={containerRef} className={`lnd-page ${visible ? 'lnd-visible' : ''}`}>

      {/* ── NAVBAR ── */}
      <nav className={`lnd-nav ${scrolled ? 'lnd-nav-scrolled' : ''}`}>
        <div className="lnd-nav-inner">
          <div className="lnd-nav-brand">
            <img src="/logoo.png" alt="NEXO" className="lnd-nav-logo" />
            <span className="lnd-nav-name">NEXO<span>CONNECT</span></span>
          </div>
          <div className="lnd-nav-links">
            <button className="lnd-nav-link" onClick={() => scrollTo('home')}>
              <i className="fa-solid fa-house" />Home
            </button>
            <button className="lnd-nav-link" onClick={() => scrollTo('features')}>
              <i className="fa-solid fa-star" />Features
            </button>
            <button className="lnd-nav-link" onClick={() => scrollTo('how')}>
              <i className="fa-solid fa-list-check" />How it works
            </button>
            <button className="lnd-nav-link" onClick={() => scrollTo('about')}>
              <i className="fa-solid fa-circle-info" />About
            </button>
          </div>
          <div className="lnd-nav-actions">
            <button className="lnd-nav-login" onClick={() => onEnter('login')}>Sign in</button>
            <button className="lnd-nav-signup" onClick={() => onEnter('signup')}>
              Create Account
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lnd-hero" id="home">
        <div className="lnd-hero-grid" />
        <div className="lnd-hero-glow glow-left" />
        <div className="lnd-hero-glow glow-right" />

        {/* LEFT — text */}
        <div className="lnd-hero-left">
          <Reveal>
            <div className="lnd-hero-badge">
              <span className="lnd-pulse-dot" />
              <span>CTU's Official Campus Network</span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h1 className="lnd-hero-title">
              <span className="lnd-word-connect">Connect.</span><br />
              <span className="lnd-word-collab">Collaborate.</span><br />
              <span className="lnd-hero-highlight">Grow Together.</span>
            </h1>
          </Reveal>

          <Reveal delay={300}>
            <p className="lnd-hero-sub">
              NEXO Connect is the verified digital hub for Cebu Technological University —
              bringing students, faculty, and organizations into one unified platform.
            </p>
          </Reveal>

          <Reveal delay={450}>
            <div className="lnd-stats-bar">
              <div className="lnd-stat">
                <span className="lnd-stat-num">{pulse.online}</span>
                <span className="lnd-stat-lbl">Verified Students</span>
              </div>
              <div className="lnd-stat-sep" />
              <div className="lnd-stat">
                <span className="lnd-stat-num">{pulse.connections}</span>
                <span className="lnd-stat-lbl">Joined Today</span>
              </div>
              <div className="lnd-stat-sep" />
              <div className="lnd-stat">
                <span className="lnd-stat-num">CTU</span>
                <span className="lnd-stat-lbl">Cebu Tech Univ.</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* RIGHT — visual */}
        <div className="lnd-hero-right">
          <div className="lnd-hero-visual">
            <div className="lnd-visual-ring lnd-ring-1" />
            <div className="lnd-visual-ring lnd-ring-2" />
            <div className="lnd-visual-ring lnd-ring-3" />
            <div className="lnd-visual-core">
              <img src="/logoo.png" alt="NEXO" className="lnd-visual-logo" />
            </div>
            {/* Floating orbit cards */}
            <div className="lnd-orbit-card lnd-orbit-1">
              <i className="fa-solid fa-users" />
              <span>Circles</span>
            </div>
            <div className="lnd-orbit-card lnd-orbit-2">
              <i className="fa-solid fa-comments" />
              <span>Chat</span>
            </div>
            <div className="lnd-orbit-card lnd-orbit-3">
              <i className="fa-solid fa-microphone" />
              <span>Auditions</span>
            </div>
            <div className="lnd-orbit-card lnd-orbit-4">
              <i className="fa-solid fa-id-card" />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="lnd-section lnd-features" id="features">
        <div className="lnd-container">
          <Reveal><p className="lnd-eyebrow">FEATURES</p></Reveal>
          <Reveal delay={150}>
            <h2 className="lnd-section-title">
              Built for the <span className="lnd-yellow">CTU experience.</span>
            </h2>
          </Reveal>
          <Reveal delay={300}>
            <p className="lnd-section-body">
              Every feature is designed to make campus life more connected and organized.
            </p>
          </Reveal>
          <div className="lnd-features-grid">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 120} style={{ height: '100%' }}>
                <div className="lnd-feature-card">
                  <div className="lnd-feature-icon">
                    <i className={f.icon} />
                  </div>
                  <h3 className="lnd-feature-title">{f.title}</h3>
                  <p className="lnd-feature-desc">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lnd-section lnd-how" id="how">
        <div className="lnd-container">
          <Reveal><p className="lnd-eyebrow">HOW IT WORKS</p></Reveal>
          <Reveal delay={150}>
            <h2 className="lnd-section-title">
              Up and running in <span className="lnd-cyan">3 simple steps.</span>
            </h2>
          </Reveal>
          <div className="lnd-steps">
            {[
              { num: '01', icon: 'fa-solid fa-user-plus',  title: 'Create Your Account', desc: 'Sign up with your CTU ID and verify your identity with your school ID photo.' },
              { num: '02', icon: 'fa-solid fa-sliders',     title: 'Complete Onboarding', desc: 'Set up your profile, pick your interests, and get matched with relevant groups.' },
              { num: '03', icon: 'fa-solid fa-earth-asia',  title: 'Join the Community',  desc: 'Explore organizations, join channels, post announcements, and start connecting.' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 180} style={{ height: '100%' }}>
                <div className="lnd-step">
                  <div className="lnd-step-top">
                    <span className="lnd-step-num">{s.num}</span>
                    <div className="lnd-step-icon"><i className={s.icon} /></div>
                  </div>
                  <h3 className="lnd-step-title">{s.title}</h3>
                  <p className="lnd-step-desc">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="lnd-section lnd-about" id="about">
        <div className="lnd-container">
          <Reveal><p className="lnd-eyebrow">ABOUT THE PLATFORM</p></Reveal>
          <Reveal delay={150}>
            <h2 className="lnd-section-title">
              Everything your campus life needs,{' '}
              <span className="lnd-cyan">in one place.</span>
            </h2>
          </Reveal>
          <Reveal delay={300}>
            <p className="lnd-section-body">
              NEXO Connect is built specifically for CTU. Every account is verified through
              your school ID so the community stays safe and real.
            </p>
          </Reveal>
          <div className="lnd-about-grid">
            {[
              { icon: 'fa-solid fa-graduation-cap',  title: 'For Students',      desc: 'Discover clubs, join groups, chat with peers, and never miss a campus event again.' },
              { icon: 'fa-solid fa-chalkboard-user', title: 'For Faculty',       desc: 'Post announcements, manage student communities, and monitor campus engagement.' },
              { icon: 'fa-solid fa-people-group',    title: 'For Organizations', desc: 'Run auditions, manage members, create channels, and grow your org on campus.' },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 150}>
                <div className="lnd-about-card">
                  <div className="lnd-about-icon"><i className={card.icon} /></div>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lnd-cta-section">
        <div className="lnd-container">
          <Reveal>
            <div className="lnd-cta-box">
              <div className="lnd-cta-grid" />
              <p className="lnd-eyebrow">JOIN THE COMMUNITY</p>
              <h2 className="lnd-cta-title">Ready to connect with CTU?</h2>
              <p className="lnd-cta-body">
                Create your verified account today and start connecting with
                students and organizations across campus.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lnd-footer">
        <div className="lnd-container">
          <div className="lnd-footer-inner">
            <div className="lnd-nav-brand">
              <img src="/logoo.png" alt="NEXO" className="lnd-nav-logo" />
              <span className="lnd-nav-name">NEXO<span>CONNECT</span></span>
            </div>
            <p className="lnd-footer-copy">
              © 2026 Cebu Technological University · NEXO Connect v2.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
