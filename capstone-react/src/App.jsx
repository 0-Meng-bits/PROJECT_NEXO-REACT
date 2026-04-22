import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import UserPortal from './components/UserPortal';
import AdminDashboard from './components/AdminDashboard';
import Pending from './components/Pending';

function ProtectedRoute({ children, allowedType }) {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) return <Navigate to="/" replace />;
  if (allowedType && user.user_type !== allowedType) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/pending" element={<Pending />} />
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
    </Routes>
  );
}
