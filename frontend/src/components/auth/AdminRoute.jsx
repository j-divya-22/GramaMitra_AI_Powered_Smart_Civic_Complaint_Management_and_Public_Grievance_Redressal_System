import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading || !user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
