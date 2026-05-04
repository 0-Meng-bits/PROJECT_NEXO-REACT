import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Splash from './Splash';
import IdVerifier from './IdVerifier';

export default function Auth() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialMode = params.get('mode') || 'splash';

  const [mode, setMode] = useState(initialMode);
  const [signupStep, setSignupStep] = useState('form'); // 'form' | 'id-verify'
  const [loading, setLoading] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState('/portal');
  const [suspendedUntil, setSuspendedUntil] = useState(null);
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
        // Don't store session yet — user needs to confirm email first
        setMode('email-sent');
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
        // Preserve locally-stored avatar in case DB doesn't have it yet
        const prevUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const mergedUser = {
          ...data.user,
          avatar_url: data.user.avatar_url || prevUser.avatar_url || null,
        };
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.setItem('currentUser', JSON.stringify(mergedUser));
        if (data.session) localStorage.setItem('accessToken', data.session.access_token);
        // Check if user has accepted terms
        if (!localStorage.getItem('nexo-terms-accepted')) {
          setPendingRoute(data.user.user_type === 'Admin' ? '/admin' : '/portal');
          setShowTermsModal(true);
        } else {
          navigate(data.user.user_type === 'Admin' ? '/admin' : '/portal');
        }
      } else {
        if (data.banned) {
          setMode('banned');
        } else if (data.suspended) {
          setSuspendedUntil(data.suspended_until);
          setMode('suspended');
        } else {
          alert('SYSTEM_ALERT: ' + data.message);
        }
      }
      alert('TERMINAL_OFFLINE: Connection failed. Make sure the backend server is running on port 3000.');
    } finally {
      setLoading(false);
    }
  };

  // ── EMAIL SENT ──
  if (mode === 'email-sent') {
    return (
      <div className="auth-page">
        <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: 'var(--cyber-cyan)', letterSpacing: 2, marginBottom: 12 }}>ACCOUNT CREATED</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            Your account has been created successfully. Please wait for admin approval before you can access the system.
          </p>
          <button className="cyber-btn" onClick={() => setMode('login')} style={{ width: '100%' }}>
            BACK TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  // ── RESET SENT ──
  if (mode === 'reset-sent') {
    return (
      <div className="auth-page">
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
    );
  }

  // ── FORGOT PASSWORD ──
  if (mode === 'forgot') {
    return (
      <div className="auth-page">
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
    );
  }

  // ── BANNED ──
  if (mode === 'banned') {
    return (
      <div className="auth-page">
        <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ color: 'var(--red)', letterSpacing: 2, marginBottom: 12 }}>ACCOUNT BANNED</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            Your account has been permanently banned due to serious violations of community guidelines.
            Please contact the administrator if you believe this is a mistake.
          </p>
          <button className="cyber-btn secondary" onClick={() => setMode('login')} style={{ width: '100%' }}>
            BACK TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  // ── SUSPENDED ──
  if (mode === 'suspended') {
    const until = suspendedUntil
      ? new Date(suspendedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '7 days';
    return (
      <div className="auth-page">
        <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏸️</div>
          <h2 style={{ color: 'var(--orange)', letterSpacing: 2, marginBottom: 12 }}>ACCOUNT SUSPENDED</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
            Your account has been temporarily suspended due to community guideline violations.
          </p>
          <div style={{ background: 'rgba(247,169,79,0.08)', border: '1px solid rgba(247,169,79,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
            <p style={{ color: 'var(--orange)', fontSize: 13, fontWeight: 700 }}>
              <i className="fa-solid fa-clock" style={{ marginRight: 8 }}></i>
              Access restored on: {until}
            </p>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
            Please review the community guidelines before your suspension ends.
          </p>
          <button className="cyber-btn secondary" onClick={() => setMode('login')} style={{ width: '100%' }}>
            BACK TO LOGIN
          </button>
        </div>
      </div>
    );
  }

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
                <label>EMAIL (for password recovery)</label>
                <input name="email" type="email" value={form.email} onChange={update}
                  placeholder="your.real@email.com" required disabled={loading}
                  pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                  title="Please enter a valid email address (e.g. name@gmail.com)" />
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
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update}
                placeholder="••••••••" required disabled={loading} minLength={6}
                style={{ paddingRight: 40 }} />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 14, padding: '4px',
                  display: 'flex', alignItems: 'center',
                }}
                tabIndex={-1}
              >
                <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
              </button>
            </div>
            {/* Password strength indicator — signup only */}
            {!isLogin && form.password.length > 0 && (() => {
              const p = form.password;
              const checks = {
                length:    p.length >= 8,
                lowercase: /[a-z]/.test(p),
                uppercase: /[A-Z]/.test(p),
                number:    /[0-9]/.test(p),
                special:   /[^a-zA-Z0-9]/.test(p),
              };
              const score = Object.values(checks).filter(Boolean).length;
              const levels = ['', 'WEAK', 'FAIR', 'GOOD', 'STRONG', 'VERY STRONG'];
              const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#00f0ff'];
              const pct = (score / 5) * 100;
              return (
                <div style={{ marginTop: 8 }}>
                  {/* Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors[score], borderRadius: 4, transition: 'width 0.3s, background 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: colors[score], minWidth: 70, textAlign: 'right' }}>{levels[score]}</span>
                  </div>
                  {/* Checklist */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                    {[
                      { key: 'length',    label: '8+ characters' },
                      { key: 'uppercase', label: 'Uppercase letter' },
                      { key: 'lowercase', label: 'Lowercase letter' },
                      { key: 'number',    label: 'Number' },
                      { key: 'special',   label: 'Special character' },
                    ].map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: checks[key] ? '#22c55e' : 'var(--text-muted)' }}>
                        <i className={checks[key] ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'} style={{ fontSize: 10 }}></i>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {!isLogin && (
            <div className="id-verify-notice">
              <i className="fa-solid fa-id-card" style={{ marginRight: 6, color: 'var(--cyber-cyan)' }} />
              You will verify your ID in the next step
            </div>
          )}

          <button type="submit" className="cyber-btn" disabled={loading}>
            {loading ? 'PROCESSING...' : isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin
            ? <>
                <p>New student? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setSignupStep('form'); }}>Create an Account</a></p>
                <p><a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>Forgot password?</a></p>
              </>
            : <p>Already registered? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Login here</a></p>
          }
        </div>
      </div>

      {/* ── TERMS & CONDITIONS MODAL ── */}
      {showTermsModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="auth-card fade-in" style={{ maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', textAlign: 'left' }}>
            <h2 style={{ color: 'var(--cyber-cyan)', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight: 8 }}></i>TERMS &amp; CONDITIONS
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1, marginBottom: 16, textAlign: 'center' }}>
              Please read and accept before continuing
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, padding: 16, marginBottom: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <p style={{ marginBottom: 10, color: 'var(--cyber-cyan)', fontWeight: 700 }}>1. Responsible Use</p>
              <p style={{ marginBottom: 12 }}>You agree to use NEXO Connect responsibly and in accordance with CTU's student conduct policies. Any misuse of the platform may result in account suspension.</p>
              <p style={{ marginBottom: 10, color: 'var(--cyber-cyan)', fontWeight: 700 }}>2. Respect for Others</p>
              <p style={{ marginBottom: 12 }}>You agree to treat all students and faculty with respect. Harassment, bullying, hate speech, or any form of discrimination is strictly prohibited.</p>
              <p style={{ marginBottom: 10, color: 'var(--cyber-cyan)', fontWeight: 700 }}>3. Personal Information</p>
              <p style={{ marginBottom: 12 }}>Do not share sensitive personal information (home address, financial details, passwords) of yourself or others on the platform.</p>
              <p style={{ marginBottom: 10, color: 'var(--cyber-cyan)', fontWeight: 700 }}>4. Content Policy</p>
              <p style={{ marginBottom: 12 }}>All content posted must be relevant to academic or campus life. Spam, explicit content, or off-topic material will be removed.</p>
              <p style={{ marginBottom: 10, color: 'var(--cyber-cyan)', fontWeight: 700 }}>5. Privacy</p>
              <p>Your data is stored securely and used only to provide the NEXO Connect service. We do not sell or share your information with third parties.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="cyber-btn" style={{ flex: 1 }} onClick={() => {
                localStorage.setItem('nexo-terms-accepted', 'true');
                setShowTermsModal(false);
                navigate(pendingRoute);
              }}>
                <i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>I ACCEPT
              </button>
              <button className="cyber-btn secondary" style={{ flex: 1 }} onClick={() => {
                setShowTermsModal(false);
                localStorage.removeItem('currentUser');
                localStorage.removeItem('accessToken');
                setMode('login');
              }}>
                <i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i>DECLINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
