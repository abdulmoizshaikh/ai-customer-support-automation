import { Navigate, Outlet } from 'react-router-dom';
import { isAuthed } from '../lib/auth';

export default function ProtectedRoute() {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Outlet />;
}