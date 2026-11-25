import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { getAuthErrorMessage } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import BilingualText from '../../components/i18n/BilingualText';

export default function CitizenRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    language,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(formData);
      setLanguage(formData.language);
      const destination = location.state?.from;
      navigate(destination ? {
        pathname: destination.pathname,
        search: destination.search,
        hash: destination.hash,
        state: destination.state,
      } : '/dashboard', { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Unable to create your account. Please try again.'));
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
          <h1 className="font-display font-bold text-2xl text-brand-ink mb-2"><BilingualText english="Create Account" /></h1>
          <p className="text-neutral-muted text-sm"><BilingualText english="Join Gramamitra and give your voice power" /></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
              <BilingualText english={error} />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="register-name" className="block text-sm font-medium text-neutral-text"><BilingualText english="Full Name" /></label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="text"
                id="register-name"
                required
                autoComplete="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Rajesh Kumar"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="register-email" className="block text-sm font-medium text-neutral-text"><BilingualText english="Email" /></label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="email"
                id="register-email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-text"><BilingualText english="Phone (optional)" /></label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="register-password" className="block text-sm font-medium text-neutral-text"><BilingualText english="Password" /></label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="password"
                id="register-password"
                minLength={8}
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-text"><BilingualText english="Preferred Language" /></label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full pr-4 py-3.5 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors appearance-none"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              <option value="ur">اردو (Urdu)</option>
              <option value="or">ଓଡ଼ିଆ (Odia)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-8 py-4 bg-brand-ink text-surface-canvas rounded-full font-bold text-lg tracking-widest uppercase shadow-saffron hover:scale-105 active:scale-95 transition-all"
          >
            <BilingualText english={isSubmitting ? 'Creating account...' : 'Create Account'} /> <ArrowRight className="w-4 h-4 inline ml-2" />
          </button>
        </form>

        <p className="mt-8 text-center text-neutral-muted text-sm">
          <BilingualText english="Already have an account?" />{' '}
          <Link to="/login" state={location.state} className="text-brand-ink font-medium hover:underline"><BilingualText english="Sign In" /></Link>
        </p>
      </div>
    </div>
  );
}
