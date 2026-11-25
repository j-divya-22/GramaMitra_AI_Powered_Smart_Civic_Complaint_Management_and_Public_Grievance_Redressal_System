import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Shield, ArrowRight } from 'lucide-react';
import { getAuthErrorMessage } from '../../services/api';
import { isLocalDemoMode } from '../../config/authMode';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login({ email, password }, 'admin');
      navigate('/admin');
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Unable to sign in. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocalDemoMode) {
    return (
      <div className="min-h-screen bg-[#f2f4f7] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#fffdfa] rounded-premium p-8 md:p-12 text-center shadow-card">
          <Shield className="w-10 h-10 text-brand-ink mx-auto mb-4" aria-hidden="true" />
          <h1 className="font-display font-bold text-2xl text-[#27334f] mb-3">Admin sign-in unavailable</h1>
          <p className="text-neutral-text mb-6">Administrator authentication requires the secure backend and PostgreSQL database.</p>
          <button onClick={() => navigate('/login')} className="px-6 py-3 bg-[#27334f] text-white rounded-full font-semibold">
            Citizen sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#27334f] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#fffdfa] rounded-premium p-8 md:p-12 border border-[#e4e6eb] shadow-card">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#fce6da] flex items-center justify-center text-[#ad4f1b] font-bold">A</div>
            <span className="font-display font-bold text-2xl text-[#27334f]">Gramamitra Admin</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-[#27334f] mb-2">Administrator Login</h1>
          <p className="text-neutral-muted text-sm">Authorized access only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="admin-email" className="block text-sm font-medium text-neutral-text">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="email"
                id="admin-email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gramamitra.in"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-password" className="block text-sm font-medium text-neutral-text">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="password"
                id="admin-password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-card border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-8 py-4 bg-[#273f3b] text-white rounded-full font-bold text-lg tracking-widest uppercase shadow-card hover:bg-[#1f3632] active:scale-[0.99] transition-all"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Lock className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? 'Signing in...' : 'Admin Sign In'}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </button>
        </form>

        <p className="mt-6 text-center text-neutral-muted text-sm">
          <Link to="/login" className="text-[#27334f] font-medium hover:underline">User login</Link>
        </p>
        <p className="mt-3 text-center text-neutral-muted text-sm">
          Don&apos;t have an admin account?{' '}
          <Link to="/admin/register" className="text-[#27334f] font-medium hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
}
