import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
