import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { getAuthErrorMessage } from '../../services/api';
import BilingualText from '../../components/i18n/BilingualText';
import { useLanguage } from '../../context/LanguageContext';

export default function CitizenLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { setLanguage, supportedLanguages } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const authenticatedUser = await login({ email, password }, 'citizen');
      if (supportedLanguages.some((item) => item.code === authenticatedUser?.language)) {
        setLanguage(authenticatedUser.language);
      }
      const destination = location.state?.from;
      navigate(destination ? {
        pathname: destination.pathname,
        search: destination.search,
        hash: destination.hash,
        state: destination.state,
      } : '/dashboard', { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Unable to sign in. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface-card rounded-premium p-8 md:p-12 border border-neutral-light shadow-card">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-ink flex items-center justify-center text-surface-canvas font-bold">J</div>
            <span className="font-display font-bold text-2xl text-brand-ink">Gramamitra</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-brand-ink mb-2"><BilingualText english="Login" /></h1>
          <p className="text-neutral-muted text-sm"><BilingualText english="Welcome back to Gramamitra" /></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              <BilingualText english={error} />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="citizen-email" className="block text-sm font-medium text-neutral-text"><BilingualText english="Email" /></label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="email"
                id="citizen-email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label htmlFor="citizen-password" className="block text-sm font-medium text-neutral-text"><BilingualText english="Password" /></label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs font-medium text-brand-ink hover:text-brand-ink/80 transition-colors"
              >
                <BilingualText english={showPassword ? 'Hide' : 'Show'} />
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="citizen-password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-8 py-4 bg-[#273f3b] text-surface-canvas rounded-full font-bold text-lg tracking-widest uppercase shadow-card hover:bg-[#1f3632] active:scale-[0.99] transition-all"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <BilingualText english={isSubmitting ? 'Signing in...' : 'Sign In'} />
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </button>
        </form>

        <p className="mt-8 text-center text-neutral-muted text-sm">
          <BilingualText english="New to Gramamitra?" />{' '}
          <Link to="/register" state={location.state} className="text-brand-ink font-medium hover:underline"><BilingualText english="Create an account" /></Link>
        </p>
      </div>
    </div>
  );
}
