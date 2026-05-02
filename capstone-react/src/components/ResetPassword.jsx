import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase puts the session in the URL hash after clicking the reset link
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password.length < 6) { alert('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { alert('Passwords do not match.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { alert('SYSTEM_ALERT: ' + error.message); return; }
    alert('Password updated successfully. Please login.');
    navigate('/');
  };

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--cyber-cyan)', fontFamily: 'monospace', letterSpacing: 2 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block' }} />
            VALIDATING RESET LINK...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <h1 className="logo-text">NEXO<span>CONNECT</span></h1>
          <p className="auth-subtitle">SET_NEW_PASSWORD...</p>
        </div>
        <form onSubmit={handleReset}>
          <div className="input-group">
            <label>NEW PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6} disabled={loading} />
          </div>
          <div className="input-group">
            <label>CONFIRM PASSWORD</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" required minLength={6} disabled={loading} />
          </div>
          <button type="submit" className="cyber-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  );
}
