import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getApiUrl } from './lib/api';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Landing from './components/Landing';
import Onboarding from './components/Onboarding';
import UserPortal from './components/UserPortal';
import AdminDashboard from './components/AdminDashboard';
import ResetPassword from './components/ResetPassword';

function LandingWrapper() {
  const navigate = useNavigate();
  return <Landing onEnter={(mode) => navigate('/auth?mode=' + mode)} />;
}

function ProtectedRoute({ children, allowedType }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const storedUser = localStorage.getItem('currentUser');

    // Restore Supabase session if tokens exist (fixes 406 errors)
    if (token && refreshToken) {
      supabase.auth.setSession({
        access_token: token,
        refresh_token: refreshToken
      }).catch(err => {
        console.error('Failed to restore Supabase session:', err);
      });
    }

    // Legacy account — no Supabase Auth yet, trust localStorage for now
    if (!token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (allowedType && user.user_type !== allowedType) {
          setStatus('fail');
        } else {
          setStatus('ok');
        }
      } catch {
        setStatus('fail');
      }
      return;
    }

    if (!token) { setStatus('fail'); return; }

    fetch(getApiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        // 401/403 = token is genuinely invalid → force logout
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setStatus('fail');
          return null;
        }
        if (!res.ok) throw new Error('network');
        return res.json();
      })
      .then(data => {
        if (!data) return; // already handled above
        // Only preserve locally-stored avatar if it belongs to the same account
        const existing = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const isSameUser = existing.student_id === data.user.student_id;
        const merged = {
          ...data.user,
          avatar_url: data.user.avatar_url || (isSameUser ? existing.avatar_url : null) || null,
        };
        localStorage.setItem('currentUser', JSON.stringify(merged));
        if (allowedType && data.user.user_type !== allowedType) {
          setStatus('fail');
        } else {
          setStatus('ok');
        }
      })
      .catch(() => {
        // Network error / server down — don't log user out, trust localStorage
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            if (allowedType && user.user_type !== allowedType) {
              setStatus('fail');
            } else {
              setStatus('ok');
            }
          } catch {
            setStatus('fail');
          }
        } else {
          setStatus('fail');
        }
      });
  }, [allowedType]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d12', gap: 16 }}>
        <img src="/logoo.png" alt="NEXO" style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(0,240,255,0.4))', mixBlendMode: 'screen' }} />
        <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 4, color: '#fcee0a' }}>
            NEXO<span style={{ color: '#00f0ff' }}> CONNECT</span>
          </div>
        </div>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, color: 'var(--cyber-cyan)', marginTop: 8 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading, please wait...</span>
      </div>
    );
  }

  if (status === 'fail') return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingWrapper />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route path="/portal" element={
        <ProtectedRoute>
          <UserPortal />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute allowedType="Admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
