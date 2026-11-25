import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function IntroGuard({ children }) {
  const { isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register') {
      navigate('/intro', { replace: true });
    }
  }, [location.pathname, isLoading, navigate]);

  return children;
}
