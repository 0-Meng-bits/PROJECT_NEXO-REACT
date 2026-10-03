import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadTheme } from '../lib/theme';

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = '', style = {} }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={className} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(40px)',
      transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

export default function Landing({ onEnter }) {
  const [pulse, setPulse] = useState({ online: 0, connections: 0 });
  const [visible, setVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    loadTheme();
    setTimeout(() => setVisible(true), 80);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const weekAgoUTC = new Date(todayUTC); weekAgoUTC.setUTCDate(weekAgoUTC.getUTCDate() - 7);
      const [{ count: total }, { count: todayCount }, { count: weekCount }] = await Promise.all([
        supabase.from('account_status').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('accounts').select('*', { count: 'exact', head: true }).gte('created_at', todayUTC.toISOString()),
        supabase.from('accounts').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoUTC.toISOString()),
      ]);
      setPulse({
        online: total || 0,
        connections: todayCount || 0,
        weekly: weekCount || 0,
      });
    };
    fetch();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  };

  const features = [
    { icon: 'fa-solid fa-users',          title: 'Campus Circles',      desc: 'Join or create your own group — whether it\'s for your course, a hobby, a project, or just hanging out with classmates.' },
    { icon: 'fa-solid fa-bullhorn',        title: 'Live Announcements',  desc: 'Stay updated with real-time posts from faculty, organizations, and fellow students. Never miss an important update.' },
    { icon: 'fa-solid fa-comments',        title: 'Group Messaging',     desc: 'Chat inside your circle in real time. Each group has its own channels so conversations stay organized.' },
    { icon: 'fa-solid fa-microphone',      title: 'Application System',  desc: 'Organizations can open applications with custom questions. Students apply directly — no need for separate forms.' },
    { icon: 'fa-solid fa-id-card',         title: 'Verified Identity',   desc: 'Every account is verified using your CTU school ID. This keeps the platform safe and school-members only.' },
    { icon: 'fa-solid fa-shield',          title: 'Trust & Moderation',  desc: 'A built-in reputation system keeps the community respectful. Admins can flag, review, and manage any content.' },
  ];

  const steps = [
    { num: '01', icon: 'fa-solid fa-user-plus',   title: 'Create Your Account',    desc: 'Sign up using your CTU student ID and upload your school ID photo to verify who you are.' },
    { num: '02', icon: 'fa-solid fa-sliders',      title: 'Set Up Your Profile',    desc: 'Pick your interests, add your course and year level, and get matched with groups that fit you.' },
    { num: '03', icon: 'fa-solid fa-earth-asia',   title: 'Explore & Connect',      desc: 'Browse circles, join conversations, attend events, and become part of the CTU campus community.' },
  ];

  return (
    <div className={`lnd-page ${visible ? 'lnd-visible' : ''}`}>

      {/* NAV */}
      <nav className={`lnd-nav ${scrolled ? 'lnd-nav-scrolled' : ''}`}>
        <div className="lnd-nav-inner">
          <div className="lnd-nav-brand">
            <img src="/logoo.png" alt="NEXO" className="lnd-nav-logo" />
            <span className="lnd-nav-name">NEXO<span>CONNECT</span></span>
          </div>
          <div className="lnd-nav-links">
            {[['home','fa-house','Home'],['features','fa-star','Features'],['how','fa-list-check','How it works'],['about','fa-circle-info','About']].map(([id, ic, label]) => (
              <button key={id} className="lnd-nav-link" onClick={() => scrollTo(id)}>
                <i className={`fa-solid ${ic}`} />{label}
              </button>
            ))}
          </div>
          <div className="lnd-nav-actions">
            <button className="lnd-nav-login" onClick={() => onEnter('login')}>Sign in</button>
            <button className="lnd-nav-signup" onClick={() => onEnter('signup')}>Create Account</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lnd-hero" id="home">
        <div className="lnd-hero-grid" />
        <div className="lnd-hero-glow glow-left" />
        <div className="lnd-hero-glow glow-right" />

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
              <span className="lnd-word-collab">Create.</span><br />
              <span className="lnd-hero-highlight">Belong.</span>
            </h1>
          </Reveal>
          <Reveal delay={280}>
            <p className="lnd-hero-sub">
              NEXO Connect is CTU's private online community, a safe space where verified users and organizations can meet, chat, share, and grow together.
            </p>
          </Reveal>
          <Reveal delay={400}>
            <div className="lnd-stats-bar">
              <div className="lnd-stat">
                <span className="lnd-stat-num">{pulse.online}</span>
                <span className="lnd-stat-lbl">Verified Students</span>
              </div>
              <div className="lnd-stat-sep" />
              <div className="lnd-stat">
                <span className="lnd-stat-num">{pulse.connections > 0 ? pulse.connections : pulse.weekly}</span>
                <span className="lnd-stat-lbl">{pulse.connections > 0 ? 'Joined Today' : 'Joined This Week'}</span>
              </div>
              <div className="lnd-stat-sep" />
              <div className="lnd-stat">
                <span className="lnd-stat-num">CTU</span>
                <span className="lnd-stat-lbl">Cebu Tech Univ.</span>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="lnd-hero-right">
          <div className="lnd-hero-visual">
            <div className="lnd-visual-ring lnd-ring-1" />
            <div className="lnd-visual-ring lnd-ring-2" />
            <div className="lnd-visual-ring lnd-ring-3" />
            <div className="lnd-visual-core">
              <img src="/logoo.png" alt="NEXO" className="lnd-visual-logo" />
            </div>
            <div className="lnd-orbit-card lnd-orbit-1"><i className="fa-solid fa-users" /><span>Circles</span></div>
            <div className="lnd-orbit-card lnd-orbit-2"><i className="fa-solid fa-comments" /><span>Chat</span></div>
            <div className="lnd-orbit-card lnd-orbit-3"><i className="fa-solid fa-microphone" /><span>Applications</span></div>
            <div className="lnd-orbit-card lnd-orbit-4"><i className="fa-solid fa-id-card" /><span>Verified</span></div>
          </div>
        </div>
      </section>

      {/* WHAT IS NEXO — plain language explainer */}
      <section className="lnd-section lnd-explainer" id="explainer">
        <div className="lnd-container">
          <div className="lnd-explainer-inner">
            <Reveal className="lnd-explainer-left">
              <p className="lnd-eyebrow">WHAT IS NEXO CONNECT?</p>
              <h2 className="lnd-section-title">
                One app. Everything campus: <span className="lnd-cyan">chat, groups, announcements, and more.</span>
              </h2>
              <p className="lnd-section-body" style={{ marginBottom: 24 }}>
                NEXO Connect is an online platform made exclusively for Cebu Technological University users.
                It's one place where you can find your classmates, join clubs, get announcements, and chat, all verified and safe.
              </p>
              <div className="lnd-explainer-points" style={{ marginTop: 28 }}>
                {[
                  { icon: 'fa-solid fa-lock', label: 'School-only access', desc: 'Only real CTU users with a verified ID can join.' },
                  { icon: 'fa-solid fa-bell', label: 'Never miss anything', desc: 'Get announcements, events, and updates in one feed.' },
                  { icon: 'fa-solid fa-users', label: 'Find your people', desc: 'Join circles that match your course, hobby, or org.' },
                ].map((p, i) => (
                  <div key={i} className="lnd-explainer-point">
                    <div className="lnd-explainer-point-icon"><i className={p.icon} /></div>
                    <div>
                      <div className="lnd-explainer-point-label">{p.label}</div>
                      <div className="lnd-explainer-point-desc">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={200} className="lnd-explainer-right">
              <div className="lnd-explainer-mockup">
                <div className="lnd-mockup-bar">
                  <span className="lnd-mockup-dot" style={{ background: '#f75f5f' }} />
                  <span className="lnd-mockup-dot" style={{ background: '#fcee0a' }} />
                  <span className="lnd-mockup-dot" style={{ background: '#3ecf8e' }} />
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>nexo-connect.vercel.app</span>
                </div>
                <div className="lnd-mockup-body">
                  <div className="lnd-mockup-sidebar">
                    <div className="lnd-mockup-icon lnd-mockup-active"><i className="fa-solid fa-earth-asia" /></div>
                    <div className="lnd-mockup-icon"><i className="fa-solid fa-code" /></div>
                    <div className="lnd-mockup-icon"><i className="fa-solid fa-star" /></div>
                    <div className="lnd-mockup-icon"><i className="fa-solid fa-gamepad" /></div>
                    <div className="lnd-mockup-icon"><i className="fa-solid fa-graduation-cap" /></div>
                  </div>
                  <div className="lnd-mockup-content">
                    <div className="lnd-mockup-pill">📣 CAMPUS FEED</div>
                    <div className="lnd-mockup-post">
                      <div className="lnd-mockup-post-header">
                        <div className="lnd-mockup-avatar">R</div>
                        <div>
                          <div className="lnd-mockup-name">Romel · <span style={{ color: 'var(--cyber-cyan)', fontSize: 9 }}>LEADER</span></div>
                          <div className="lnd-mockup-time">just now</div>
                        </div>
                      </div>
                      <div className="lnd-mockup-text">General Assembly this Friday at 2PM — Gymnasium. All members please attend! 🎓</div>
                    </div>
                    <div className="lnd-mockup-post" style={{ opacity: 0.6 }}>
                      <div className="lnd-mockup-post-header">
                        <div className="lnd-mockup-avatar" style={{ background: 'rgba(252,238,10,0.2)', color: 'var(--cyber-yellow)' }}>A</div>
                        <div>
                          <div className="lnd-mockup-name">Aridan · <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>MEMBER</span></div>
                          <div className="lnd-mockup-time">5m ago</div>
                        </div>
                      </div>
                      <div className="lnd-mockup-text">Anyone joining the robotics showcase? 🤖</div>
                    </div>
                    <div className="lnd-mockup-input">
                      <span>Write a message...</span>
                      <div className="lnd-mockup-send"><i className="fa-solid fa-paper-plane" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lnd-section lnd-features" id="features">
        <div className="lnd-container">
          <Reveal><p className="lnd-eyebrow">FEATURES</p></Reveal>
          <Reveal delay={120}>
            <h2 className="lnd-section-title">Built for the <span className="lnd-yellow">CTU experience.</span></h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="lnd-section-body">Everything you need for campus life, in one app, made just for you.</p>
          </Reveal>
          <div className="lnd-features-grid">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 80} style={{ height: '100%' }}>
                <div className="lnd-feature-card">
                  <div className="lnd-feature-icon"><i className={f.icon} /></div>
                  <h3 className="lnd-feature-title">{f.title}</h3>
                  <p className="lnd-feature-desc">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lnd-section lnd-how" id="how">
        <div className="lnd-container">
          <Reveal><p className="lnd-eyebrow">HOW IT WORKS</p></Reveal>
          <Reveal delay={120}>
            <h2 className="lnd-section-title">Up and running in <span className="lnd-cyan">3 simple steps.</span></h2>
          </Reveal>
          <div className="lnd-steps">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 160} style={{ height: '100%' }}>
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

      {/* WHO IS IT FOR */}
      <section className="lnd-section lnd-about" id="about">
        <div className="lnd-container">
          <Reveal><p className="lnd-eyebrow">ABOUT THE PLATFORM</p></Reveal>
          <Reveal delay={120}>
            <h2 className="lnd-section-title">Everything your campus life needs, <span className="lnd-cyan">in one place.</span></h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="lnd-section-body">
              NEXO Connect is built specifically for CTU. Every account is verified through your school ID so the community stays safe and real.
            </p>
          </Reveal>
          <div className="lnd-about-grid">
            {[
              {
                icon: 'fa-solid fa-users',
                color: 'var(--cyber-cyan)',
                title: 'For Users',
                desc: 'Whether you\'re a student or faculty, discover groups, chat with peers, join organizations, and stay updated with everything happening on campus.',
                highlights: ['Join academic and hobby circles', 'Chat with classmates', 'Apply to organizations', 'Post and share with campus'],
              },
              {
                icon: 'fa-solid fa-sitemap',
                color: 'var(--green)',
                title: 'For Organizations',
                desc: 'Run your org online. Accept applications, manage members, create channels, and grow your presence on campus.',
                highlights: ['Open applications', 'Manage your members', 'Create dedicated channels'],
              },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 140}>
                <div className="lnd-about-card">
                  <div className="lnd-about-icon" style={{ color: card.color, borderColor: card.color }}>
                    <i className={card.icon} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                  <ul className="lnd-about-highlights">
                    {card.highlights.map((h, j) => (
                      <li key={j}><i className="fa-solid fa-check" style={{ color: card.color, marginRight: 8, fontSize: 10 }} />{h}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lnd-cta-section">
        <div className="lnd-container">
          <Reveal>
            <div className="lnd-cta-box">
              <div className="lnd-cta-grid" />
              <div className="lnd-cta-badge">
                <span className="lnd-pulse-dot" />
                <span>JOIN THE COMMUNITY</span>
              </div>
              <h2 className="lnd-cta-title">Ready to connect with CTU?</h2>
              <p className="lnd-cta-body">
                Create your free verified account today and start connecting with students and organizations across campus.
                Takes less than 2 minutes.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lnd-footer">
        <div className="lnd-container">
          <div className="lnd-footer-inner">
            <div className="lnd-nav-brand">
              <img src="/logoo.png" alt="NEXO" className="lnd-nav-logo" />
              <span className="lnd-nav-name">NEXO<span>CONNECT</span></span>
            </div>
            <div className="lnd-footer-links">
              {[['home','Home'],['features','Features'],['how','How it works'],['about','About']].map(([id, label]) => (
                <button key={id} className="lnd-footer-link" onClick={() => scrollTo(id)}>{label}</button>
              ))}
            </div>
            <p className="lnd-footer-copy">© 2026 Cebu Technological University · NEXO Connect</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
