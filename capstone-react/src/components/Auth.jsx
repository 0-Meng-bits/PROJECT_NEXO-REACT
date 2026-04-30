import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Splash from './Splash';
import IdVerifier from './IdVerifier';

export default function Auth() {
  const [mode, setMode] = useState('splash'); // 'splash' | 'login' | 'signup'
  const [signupStep, setSignupStep] = useState('form'); // 'form' | 'id-verify'
  const [loading, setLoading] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [form, setForm] = useState({
    ctuId: '', password: '', fullName: '', email: '', userType: 'Student'
  });
  const navigate = useNavigate();

  const update = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // Called when signup form is submitted — go to ID verify step first
  const handleSignupFormSubmit = (e) => {
    e.preventDefault();
    // Auto-generate email from CTU ID so user doesn't need to enter it
    const autoEmail = `${form.ctuId.toLowerCase().replace(/[^a-z0-9]/g, '')}@ctu.edu.ph`;
    setForm(f => ({ ...f, email: autoEmail }));
    setSignupStep('id-verify');
  };

  // Called after ID photo is submitted — do the actual signup
  const doSignup = async (verified, idPhotoUrl) => {
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.ctuId,
          password: form.password,
          fullName: form.fullName,
          email: form.email,
          user_type: form.userType,
          id_verified: verified,
          id_photo_url: idPhotoUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert('SYSTEM_ALERT: ' + data.message);
        setSignupStep('form');
      } else {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (data.session) localStorage.setItem('accessToken', data.session.access_token);
        navigate('/onboarding');
      }
    } catch {
      alert('TERMINAL_OFFLINE: Connection failed.');
      setSignupStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: form.ctuId, password: form.password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (data.session) localStorage.setItem('accessToken', data.session.access_token);
        navigate(data.user.user_type === 'Admin' ? '/admin' : '/portal');
      } else {
        alert('SYSTEM_ALERT: ' + data.message);
      }
    } catch {
      alert('TERMINAL_OFFLINE: Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── SPLASH ──
  if (mode === 'splash') {
    return <Splash onEnter={(m) => { setMode(m); setSignupStep('form'); }} />;
  }

  // ── ID VERIFY STEP ──
  if (mode === 'signup' && signupStep === 'id-verify') {
    return (
      <div className="auth-page">
        <div className="auth-card fade-in" style={{ maxWidth: 460 }}>
          <button className="auth-back-btn" onClick={() => setSignupStep('form')} type="button">
            <i className="fa-solid fa-arrow-left" /> Back
          </button>
          <h1 className="logo-text" style={{ marginBottom: 4 }}>NEXO<span>CONNECT</span></h1>
          <p className="auth-subtitle">VERIFYING_IDENTITY...</p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--cyber-cyan)', fontFamily: 'monospace' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block' }} />
              CREATING ACCOUNT...
            </div>
          ) : (
            <IdVerifier
              ctuId={form.ctuId}
              onVerified={() => doSignup(true)}
              onSkip={() => doSignup(false)}
            />
          )}
        </div>
      </div>
    );
  }

  const isLogin = mode === 'login';

  // ── LOGIN / SIGNUP FORM ──
  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <button className="auth-back-btn" onClick={() => setMode('splash')} type="button">
            <i className="fa-solid fa-arrow-left" /> Back
          </button>
          <h1 className="logo-text">NEXO<span>CONNECT</span></h1>
          <p className="auth-subtitle">
            {isLogin ? 'INITIALIZING_SECURE_SESSION...' : 'ESTABLISHING_NEW_IDENTITY...'}
          </p>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleSignupFormSubmit}>
          <div className="input-group">
            <label>CTU_ID</label>
            <input name="ctuId" value={form.ctuId} onChange={update}
              placeholder="e.g. 2024-CTU-DB-001" required disabled={loading} />
          </div>

          {!isLogin && (
            <>
              <div className="input-group">
                <label>FULL_NAME</label>
                <input name="fullName" value={form.fullName} onChange={update}
                  placeholder="Juan Dela Cruz" required disabled={loading} />
              </div>
              <div className="input-group">
                <label>USER_TYPE</label>
                <select name="userType" value={form.userType} onChange={update} disabled={loading}>
                  <option value="Student">STUDENT</option>
                  <option value="Faculty">FACULTY</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label>PASSWORD</label>
            <input name="password" type="password" value={form.password} onChange={update}
              placeholder="••••••••" required disabled={loading} />
          </div>

          {!isLogin && (
            <div className="id-verify-notice">
              <i className="fa-solid fa-id-card" style={{ marginRight: 6, color: 'var(--cyber-cyan)' }} />
              Next step: verify your school ID photo
            </div>
          )}

          <button type="submit" className="cyber-btn" disabled={loading}>
            {loading ? 'PROCESSING...' : isLogin ? 'LOGIN' : 'NEXT: VERIFY ID →'}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin
            ? <p>New student? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setSignupStep('form'); }}>Create an Account</a></p>
            : <p>Already registered? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Login here</a></p>
          }
        </div>
      </div>
    </div>
  );
}
