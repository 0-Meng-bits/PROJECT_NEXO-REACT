import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadTheme } from '../lib/theme';

// ── LANDING PAGE ──────────────────────────────────────────────────────────────
export default function Landing({ onEnter }) {
  const [pulse, setPulse] = useState({ online: 0, connections: 0 });
  const [visible, setVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    loadTheme(); // Apply saved theme on mount
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 60);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
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

  const features = [
    { icon: 'fa-solid fa-users',      title: 'Campus Circles',     desc: 'Join student-led groups, clubs, and organizations. Find your people and build lasting connections within CTU.' },
    { icon: 'fa-solid fa-bullhorn',   title: 'Live Announcements', desc: 'Stay updated with real-time campus news, event posts, and important notices from faculty and orgs.' },
    { icon: 'fa-solid fa-comments',   title: 'Group Messaging',    desc: 'Chat with classmates and org members in dedicated channels. Collaborate, plan, and stay in sync.' },
    { icon: 'fa-solid fa-microphone', title: 'Audition System',    desc: 'Organizations post auditions and accept applications directly — no more paper forms or missed tryouts.' },
    { icon: 'fa-solid fa-id-card',    title: 'Verified Identity',  desc: 'Every account is verified using your CTU school ID, keeping the community safe and trusted.' },
    { icon: 'fa-solid fa-chart-bar',  title: 'Admin Dashboard',    desc: 'Faculty and admins get powerful tools to manage students, review verifications, and monitor activity.' },
  ];

  const steps = [
    { num: '01', icon: 'fa-solid fa-user-plus',  title: 'Create Your Account', desc: 'Sign up with your CTU ID and verify your identity with your school ID photo.' },
    { num: '02', icon: 'fa-solid fa-sliders',     title: 'Complete Onboarding', desc: 'Set up your profile, pick your interests, and get matched with relevant groups.' },
    { num: '03', icon: 'fa-solid fa-earth-asia',  title: 'Join the Community',  desc: 'Explore organizations, join channels, post announcements, and start connecting.' },
  ];

  return (
    <div ref={containerRef} className={`lnd-page ${visible ? 'lnd-visible' : ''}`}>

      {/* ── STICKY NAV ── */}
      <nav className={`lnd-nav ${scrolled ? 'lnd-nav-scrolled' : ''}`}>
        <div className="lnd-nav-inner">
          <div className="lnd-nav-brand">
            <img src="/logoo.png" alt="NEXO" className="lnd-nav-logo" />
            <span className="lnd-nav-name">NEXO<span>CONNECT</span></span>
          </div>
          <div className="lnd-nav-actions">
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lnd-hero">
        <div className="lnd-hero-grid" />
        <div className="lnd-hero-glow glow-left" />
        <div className="lnd-hero-glow glow-right" />

        <div className="lnd-hero-content">
          <div className="lnd-hero-badge">
            <span className="lnd-pulse-dot" />
            <span>CTU's Official Campus Network</span>
          </div>

          {/* Each word gets its own color from the image palette */}
          <h1 className="lnd-hero-title">
            <span className="lnd-word-connect">Connect.</span>{' '}
            <span className="lnd-word-collab">Collaborate.</span>
            <br />
            <span className="lnd-hero-highlight">Grow Together.</span>
          </h1>

          <p className="lnd-hero-sub">
            NEXO Connect is the verified digital hub for Cebu Technological University —
            bringing students, faculty, and organizations into one unified platform.
          </p>

          <button className="lnd-hero-cta" onClick={() => onEnter('signup')}>
            <i className="fa-solid fa-user-plus" />
            Create Account
          </button>

          <p className="lnd-hero-login-hint">
            Already a member?{' '}
            <button className="lnd-inline-link" onClick={() => onEnter('login')}>
              Log in here
            </button>
          </p>

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
        </div>

        <div className="lnd-scroll-hint">
          <span>Scroll to explore</span>
          <i className="fa-solid fa-chevron-down lnd-bounce" />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="lnd-section lnd-about">
        <div className="lnd-container">
          <p className="lnd-eyebrow">ABOUT THE PLATFORM</p>
          <h2 className="lnd-section-title">
            Everything your campus life needs,{' '}
            <span className="lnd-cyan">in one place.</span>
          </h2>
          <p className="lnd-section-body">
            NEXO Connect is built specifically for CTU. Whether you're looking to join an
            organization, stay updated on campus events, or connect with classmates —
            every account is verified through your school ID so the community stays safe and real.
          </p>
          <div className="lnd-about-grid">
            {[
              { icon: 'fa-solid fa-graduation-cap',  title: 'For Students',      desc: 'Discover clubs, join groups, chat with peers, and never miss a campus event again.' },
              { icon: 'fa-solid fa-chalkboard-user', title: 'For Faculty',       desc: 'Post announcements, manage student communities, and monitor campus engagement.' },
              { icon: 'fa-solid fa-people-group',    title: 'For Organizations', desc: 'Run auditions, manage members, create channels, and grow your org on campus.' },
            ].map((card, i) => (
              <div className="lnd-about-card" key={i}>
                <div className="lnd-about-icon">
                  <i className={card.icon} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lnd-section lnd-features">
        <div className="lnd-container">
          <p className="lnd-eyebrow">FEATURES</p>
          <h2 className="lnd-section-title">
            Built for the <span className="lnd-yellow">CTU experience.</span>
          </h2>
          <p className="lnd-section-body">
            From real-time messaging to verified identity — every feature is designed
            to make campus life more connected and organized.
          </p>
          <div className="lnd-features-grid">
            {features.map((f, i) => (
              <div className="lnd-feature-card" key={i}>
                <div className="lnd-feature-icon">
                  <i className={f.icon} />
                </div>
                <h3 className="lnd-feature-title">{f.title}</h3>
                <p className="lnd-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lnd-section lnd-how">
        <div className="lnd-container">
          <p className="lnd-eyebrow">HOW IT WORKS</p>
          <h2 className="lnd-section-title">
            Up and running in <span className="lnd-cyan">3 simple steps.</span>
          </h2>
          <div className="lnd-steps">
            {steps.map((s, i) => (
              <div className="lnd-step" key={i}>
                <div className="lnd-step-top">
                  <span className="lnd-step-num">{s.num}</span>
                  <div className="lnd-step-icon"><i className={s.icon} /></div>
                </div>
                <h3 className="lnd-step-title">{s.title}</h3>
                <p className="lnd-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lnd-cta-section">
        <div className="lnd-container">
          <div className="lnd-cta-box">
            <div className="lnd-cta-grid" />
            <p className="lnd-eyebrow">JOIN THE COMMUNITY</p>
            <h2 className="lnd-cta-title">Ready to connect with CTU?</h2>
            <p className="lnd-cta-body">
              Create your verified account today and start connecting with
              students and organizations across campus.
            </p>
            <button className="lnd-cta-btn" onClick={() => onEnter('signup')}>
              <i className="fa-solid fa-user-plus" />
              Create Account
            </button>
            <p className="lnd-cta-login">
              Already registered?{' '}
              <button className="lnd-inline-link" onClick={() => onEnter('login')}>Log in</button>
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lnd-footer">
        <div className="lnd-container">
          <div className="lnd-footer-inner">
            <div className="lnd-footer-brand">
              <img src="/logoo.png" alt="NEXO" className="lnd-footer-logo" />
              <span className="lnd-footer-name">NEXO<span>CONNECT</span></span>
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
