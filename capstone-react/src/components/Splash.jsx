import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Splash({ onEnter }) {
  const [pulse, setPulse] = useState({ online: 0, connections: 0 });
  const [visible, setVisible] = useState(false);
  const [tagline, setTagline] = useState(0);

  const taglines = [
    'CONNECT. COLLABORATE. GROW.',
    'YOUR CAMPUS. YOUR COMMUNITY.',
    'WHERE CTU STUDENTS UNITE.',
  ];

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Cycle taglines
  useEffect(() => {
    const t = setInterval(() => setTagline(p => (p + 1) % taglines.length), 3000);
    return () => clearInterval(t);
  }, []);

  // Fetch live pulse stats
  useEffect(() => {
    const fetchPulse = async () => {
      // Count verified profiles as proxy for "active users"
      const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true);

      // Count profiles created today as "new connections"
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      setPulse({
        online: total || 0,
        connections: todayCount || 0,
      });
    };
    fetchPulse();
  }, []);

  return (
    <div className={`splash-page ${visible ? 'visible' : ''}`}>
      {/* Animated grid background */}
      <div className="splash-grid" />

      {/* Floating orbs */}
      <div className="splash-orb orb-1" />
      <div className="splash-orb orb-2" />
      <div className="splash-orb orb-3" />

      <div className="splash-content">
        {/* Logo */}
        <div className="splash-logo-wrap">
          <div className="splash-logo-ring" />
          <img src="/logoo.png" alt="NEXO" className="splash-logo-img" />
        </div>

        <h1 className="splash-title">
          NEXO<span>CONNECT</span>
        </h1>

        <p className="splash-tagline" key={tagline}>
          {taglines[tagline]}
        </p>

        {/* Live Campus Pulse */}
        <div className="splash-pulse-card">
          <div className="pulse-dot" />
          <span className="pulse-label">LIVE CAMPUS PULSE</span>
          <div className="pulse-stats">
            <div className="pulse-stat">
              <span className="pulse-num">{pulse.online}</span>
              <span className="pulse-desc">verified students</span>
            </div>
            <div className="pulse-divider" />
            <div className="pulse-stat">
              <span className="pulse-num">{pulse.connections}</span>
              <span className="pulse-desc">joined today</span>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="splash-btns">
          <button className="splash-btn primary" onClick={() => onEnter('login')}>
            <i className="fa-solid fa-right-to-bracket" style={{ marginRight: 8 }} />
            LOGIN
          </button>
          <button className="splash-btn secondary" onClick={() => onEnter('signup')}>
            <i className="fa-solid fa-user-plus" style={{ marginRight: 8 }} />
            CREATE ACCOUNT
          </button>
        </div>

        <p className="splash-footer">
          Cebu Technological University · NEXO Connect v2.0
        </p>
      </div>
    </div>
  );
}
