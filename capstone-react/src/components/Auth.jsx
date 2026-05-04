import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Landing from './Landing';
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
    if (form.password.length < 6) {
      alert('SYSTEM_ALERT: Password must be at least 6 characters.');
      return;
    }
    setSignupStep('id-verify');
  };

  // Called after ID photo is submitted — do the actual signup
  const doSignup = async (verified, idPhotoFile) => {
    setLoading(true);
    try {
      // Convert photo file to base64 to upload server-side (avoids storage auth issues)
      let id_photo_base64 = null;
      let id_photo_ext = null;
      if (idPhotoFile instanceof File) {
        const buf = await idPhotoFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        id_photo_base64 = btoa(binary);
        id_photo_ext = idPhotoFile.name?.split('.').pop() || 'jpg';
      }

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
          id_photo_base64,
          id_photo_ext,
        }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text || `Server error ${res.status}` }; }
      if (!res.ok) {
        alert('SYSTEM_ALERT: ' + data.message);
        setSignupStep('form');
      } else {
        // New account — never inherit avatar from a previous account
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.setItem('currentUser', JSON.stringify({ ...data.user, avatar_url: null }));
        if (data.session) localStorage.setItem('accessToken', data.session.access_token);
        navigate('/onboarding');
      }
    } catch (err) {
      console.error('[SIGNUP ERROR]', err);
      alert('TERMINAL_OFFLINE: ' + (err?.message || 'Connection failed.'));
      setSignupStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: form.ctuId }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text || `Server error ${res.status}` }; }
      if (res.ok) {
        setMode('reset-sent');
      } else {
        alert('SYSTEM_ALERT: ' + data.message);
      }
    } catch (err) {
      alert('TERMINAL_OFFLINE: ' + (err?.message || 'Connection failed.'));
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
        // Only preserve locally-stored avatar if it belongs to THIS same account
        const prevUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const isSameUser = prevUser.student_id === data.user.student_id;
        const mergedUser = {
          ...data.user,
          avatar_url: data.user.avatar_url || (isSameUser ? prevUser.avatar_url : null) || null,
        };
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.setItem('currentUser', JSON.stringify(mergedUser));
        if (data.session) localStorage.setItem('accessToken', data.session.access_token);
        navigate(data.user.user_type === 'Admin' ? '/admin' : '/portal');
      } else {
        // Check if it's an email verification error
        if (data.message?.includes('Email not confirmed') || data.message?.includes('email')) {
          alert('SYSTEM_ALERT: Please verify your email first. Check your inbox for the verification link.');
        } else {
          alert('SYSTEM_ALERT: ' + data.message);
        }
      }
    } catch {
      alert('TERMINAL_OFFLINE: Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── EMAIL SENT ──
  if (mode === 'email-sent') {
    return (
      <div className="auth-page">
        <div className="auth-card-glow" style={{ width: '420px' }}>
          <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ color: 'var(--cyber-cyan)', letterSpacing: 2, marginBottom: 12 }}>CHECK YOUR EMAIL</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            We've sent a verification link to <strong style={{ color: 'var(--cyber-yellow)' }}>{form.email}</strong>.
            Click the link in the email to verify your account, then wait for admin approval.
          </p>
          <button className="cyber-btn" onClick={() => setMode('login')} style={{ width: '100%' }}>
            BACK TO LOGIN
          </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESET SENT ──
  if (mode === 'reset-sent') {
    return (
      <div className="auth-page">
        <div className="auth-card-glow" style={{ width: '420px' }}>
          <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
          <h2 style={{ color: 'var(--cyber-cyan)', letterSpacing: 2, marginBottom: 12 }}>CHECK YOUR EMAIL</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            A password reset link has been sent to your registered email. Click the link to set a new password.
          </p>
          <button className="cyber-btn" onClick={() => setMode('login')} style={{ width: '100%' }}>
            BACK TO LOGIN
          </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FORGOT PASSWORD ──
  if (mode === 'forgot') {
    return (
      <div className="auth-page">
        <div className="auth-card-glow" style={{ width: '420px' }}>
          <div className="auth-card fade-in">
          <div className="auth-header">
            <button className="auth-back-btn" onClick={() => setMode('login')} type="button">
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            <h1 className="logo-text">NEXO<span>CONNECT</span></h1>
            <p className="auth-subtitle">RECOVERING_ACCESS...</p>
          </div>
          <form onSubmit={handleForgotPassword}>
            <div className="input-group">
              <label>CTU_ID</label>
              <input name="ctuId" value={form.ctuId} onChange={update}
                placeholder="e.g. 2024-CTU-DB-001" required disabled={loading} />
            </div>
            <button type="submit" className="cyber-btn" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
          </form>
          </div>
        </div>
      </div>
    );
  }

  // ── SPLASH ──
  if (mode === 'splash') {
    return <Landing onEnter={(m) => { setMode(m); setSignupStep('form'); }} />;
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
              onVerified={(verified, photoFile) => doSignup(verified, photoFile)}
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
      <div className="auth-card-glow" style={{ width: isLogin ? '420px' : '600px' }}>
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
          {isLogin ? (
            /* ── LOGIN — single column ── */
            <>
              <div className="input-group">
                <label>CTU_ID</label>
                <input name="ctuId" value={form.ctuId} onChange={update}
                  placeholder="e.g. 2024-CTU-DB-001" required disabled={loading} />
              </div>
              <div className="input-group">
                <label>PASSWORD</label>
                <input name="password" type="password" value={form.password} onChange={update}
                  placeholder="••••••••" required disabled={loading} minLength={6} />
              </div>
            </>
          ) : (
            /* ── SIGNUP — two columns ── */
            <div className="signup-two-col">
              {/* LEFT */}
              <div className="signup-col">
                <div className="input-group">
                  <label>CTU_ID</label>
                  <input name="ctuId" value={form.ctuId} onChange={update}
                    placeholder="e.g. 2024-CTU-DB-001" required disabled={loading} />
                </div>
                <div className="input-group">
                  <label>FULL_NAME</label>
                  <input name="fullName" value={form.fullName} onChange={update}
                    placeholder="Juan Dela Cruz" required disabled={loading} />
                </div>
                <div className="input-group">
                  <label>EMAIL (for password recovery)</label>
                  <input name="email" type="email" value={form.email} onChange={update}
                    placeholder="your.real@email.com" required disabled={loading}
                    pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                    title="Please enter a valid email address" />
                </div>
              </div>
              {/* RIGHT */}
              <div className="signup-col">
                <div className="input-group">
                  <label>USER_TYPE</label>
                  <select name="userType" value={form.userType} onChange={update} disabled={loading}>
                    <option value="Student">STUDENT</option>
                    <option value="Faculty">FACULTY</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>PASSWORD</label>
                  <input name="password" type="password" value={form.password} onChange={update}
                    placeholder="••••••••" required disabled={loading} minLength={6} />
                </div>
                <div className="id-verify-notice">
                  <i className="fa-solid fa-id-card" style={{ marginRight: 6, color: 'var(--cyber-cyan)' }} />
                  You will verify your ID in the next step
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="cyber-btn ripple-btn"
            disabled={loading}
            onClick={(e) => {
              const btn = e.currentTarget;
              const circle = document.createElement('span');
              const diameter = Math.max(btn.clientWidth, btn.clientHeight);
              const radius = diameter / 2;
              const rect = btn.getBoundingClientRect();
              circle.style.width = circle.style.height = `${diameter}px`;
              circle.style.left = `${e.clientX - rect.left - radius}px`;
              circle.style.top = `${e.clientY - rect.top - radius}px`;
              circle.classList.add('ripple');
              btn.querySelector('.ripple')?.remove();
              btn.appendChild(circle);
            }}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        {isLogin ? (
          <div className="auth-bottom-row">
            <a href="#" className="auth-bottom-link" onClick={(e) => { e.preventDefault(); setMode('signup'); setSignupStep('form'); }}>
               Create an account
            </a>
            <a href="#" className="auth-bottom-link" onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>
              Forgot password?
            </a>
          </div>
        ) : (
          <div className="auth-footer" style={{ textAlign: 'center' }}>
            <p>Already registered? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Login here</a></p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
