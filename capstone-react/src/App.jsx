import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import Onboarding from './components/Onboarding';
import UserPortal from './components/UserPortal';
import AdminDashboard from './components/AdminDashboard';
import ResetPassword from './components/ResetPassword';

function ProtectedRoute({ children, allowedType }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('currentUser');

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

    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Invalid session');
        return res.json();
      })
      .then(data => {
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
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        setStatus('fail');
      });
  }, [allowedType]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d12', color: 'var(--cyber-cyan)', fontFamily: 'monospace', letterSpacing: 2 }}>
        VERIFYING SESSION...
      </div>
    );
  }

  if (status === 'fail') return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
