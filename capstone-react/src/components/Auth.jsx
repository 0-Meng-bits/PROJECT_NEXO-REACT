import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ctuId: '', password: '', fullName: '', email: '', userType: 'Student' });
  const navigate = useNavigate();

  const update = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: form.ctuId, password: form.password }),
        });

        if (res.status === 403) { navigate('/pending'); return; }

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('currentUser', JSON.stringify(data.user));
          navigate(data.user.user_type === 'Admin' ? '/admin' : '/portal');
        } else {
          alert('SYSTEM_ALERT: ' + data.message);
        }
      } else {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: form.ctuId,
            password: form.password,
            fullName: form.fullName,
            email: form.email,
            user_type: form.userType,
          }),
        });

        if (res.status === 403) { navigate('/pending'); return; }
        const data = await res.json();
        if (!res.ok) alert('SYSTEM_ALERT: ' + data.message);
      }
    } catch {
      alert('TERMINAL_OFFLINE: Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <h1 className="logo-text">NEXO<span>CONNECT</span></h1>
          <p className="auth-subtitle">
            {isLogin ? 'INITIALIZING_SECURE_SESSION...' : 'ESTABLISHING_NEW_IDENTITY...'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>CTU_ID</label>
            <input name="ctuId" value={form.ctuId} onChange={update} placeholder="e.g. 2024-CTU-DB-001" required />
          </div>

          {!isLogin && (
            <>
              <div className="input-group">
                <label>FULL_NAME</label>
                <input name="fullName" value={form.fullName} onChange={update} placeholder="Juan Dela Cruz" required />
              </div>
              <div className="input-group">
                <label>CTU_EMAIL</label>
                <input name="email" type="email" value={form.email} onChange={update} placeholder="name@ctu.edu.ph" required />
              </div>
              <div className="input-group">
                <label>USER_TYPE</label>
                <select name="userType" value={form.userType} onChange={update}>
                  <option value="Student">STUDENT</option>
                  <option value="Faculty">FACULTY</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label>PASSWORD</label>
            <input name="password" type="password" value={form.password} onChange={update} placeholder="••••••••" required />
          </div>

          <button type="submit" className="cyber-btn" disabled={loading}>
            {loading ? 'PROCESSING...' : isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin
            ? <p>New student? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>Create an Account</a></p>
            : <p>Already registered? <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>Login here</a></p>
          }
        </div>
      </div>
    </div>
  );
}
