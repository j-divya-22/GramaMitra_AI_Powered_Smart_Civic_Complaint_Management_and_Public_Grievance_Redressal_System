import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { isLocalDemoMode } from '../config/authMode';
import { getLocalSession, loginLocalUser, logoutLocalUser, registerLocalUser } from '../services/localAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const isAdmin = user?.role === 'admin';
  const clearAuthError = useCallback(() => setAuthError(''), []);

  useEffect(() => {
    let active = true;

    if (isLocalDemoMode) {
      try {
        setUser(getLocalSession());
      } catch (error) {
        setAuthError(error.message);
      }
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    authAPI.me()
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status !== 401) {
          setAuthError(error.response?.data?.error || 'Unable to verify your session. Check that the backend is running.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async ({ email, password }, role = 'citizen') => {
    if (isLocalDemoMode) {
      if (role !== 'citizen') throw new Error('Administrator sign-in requires the backend.');
      const userData = await loginLocalUser({ email, password });
      setUser(userData);
      setAuthError('');
      return userData;
    }

    const { data } = await authAPI.login({ email, password, role });
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const register = async (userData) => {
    if (isLocalDemoMode) {
      const user = await registerLocalUser(userData);
      setUser(user);
      setAuthError('');
      return user;
    }

    const { data } = await authAPI.register(userData);
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const registerAdmin = async (userData) => {
    if (isLocalDemoMode) {
      throw new Error('Admin registration requires API mode and a server invitation code.');
    }

    const { data } = await authAPI.registerAdmin(userData);
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const logout = async () => {
    if (isLocalDemoMode) {
      logoutLocalUser();
      setUser(null);
      return;
    }

    await authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAdmin,
      isLocalDemoMode,
      authError,
      clearAuthError,
      login,
      register,
      registerAdmin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
