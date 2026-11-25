import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function CitizenRoute({ children }) {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
