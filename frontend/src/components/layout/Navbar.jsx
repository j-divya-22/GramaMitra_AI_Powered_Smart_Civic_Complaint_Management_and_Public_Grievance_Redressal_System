import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { toast } from 'react-hot-toast';
import { Menu, Home, Upload, LogOut, Shield, ChevronDown, MapPinned, Gift, Headphones, IndianRupee } from 'lucide-react';
import LoginMenu from '../auth/LoginMenu';
import BilingualText from '../i18n/BilingualText';

export default function Navbar() {
  const { user: authUser, isAdmin: authIsAdmin, logout } = useAuth();
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to log out. Please try again.');
    }
  };

  const isAuthPage = ['/login', '/register', '/admin/login'].includes(location.pathname);

  const adminItems = [
    { path: '/admin', label: 'Admin Dashboard', icon: Shield },
    { path: '/admin/regional-insights', label: 'Regional Insights', icon: MapPinned },
    { path: '/admin/rewards', label: 'Rewards & Payments', icon: IndianRupee },
  ];
  const navItems = authIsAdmin ? adminItems : [
    { path: '/dashboard', label: 'My Dashboard', icon: Home },
    { path: '/rewards', label: 'My Rewards', icon: Gift },
    { path: '/customer-care', label: 'Customer Care', icon: Headphones },
    { path: '/report', label: 'Report Issue', icon: Upload },
  ];

  return (
    <nav className={`sticky top-0 z-50 w-full border-b backdrop-blur-md ${
      authIsAdmin
        ? 'border-[#dfe2e8] bg-[#f8f9fb]/95'
        : 'border-neutral-light bg-surface-canvas/95'
    }`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" onClick={(e) => {
          if (!isAuthPage) e.preventDefault();
        }}>
          <img src="/assets/images/logo.png" alt="Gramamitra logo" className="h-10 w-10 object-contain" />
          <div>
            <span className={`font-display font-bold text-xl tracking-tight ${authIsAdmin ? 'text-[#27334f]' : 'text-brand-ink'}`}>Gramamitra</span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-muted">ग्राममित्र</span>
          </div>
        </Link>

        {!isAuthPage && (
          <div className="hidden lg:flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  (authIsAdmin && item.path === '/admin') || location.pathname === item.path
                    ? authIsAdmin ? 'bg-[#fce6da] text-[#ad4f1b] shadow-card' : 'bg-brand-ink text-surface-canvas shadow-saffron'
                    : 'text-neutral-text hover:bg-neutral-light hover:text-brand-ink'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {authIsAdmin ? item.label : <BilingualText english={item.label} />}
              </Link>
            ))}
            {!authIsAdmin && (
              <div className="relative ml-1">
                <label htmlFor="desktop-language" className="sr-only">Language</label>
                <select
                  id="desktop-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="appearance-none rounded-full border border-neutral-light bg-white py-2 pl-3 pr-8 text-xs font-bold text-neutral-text outline-none transition hover:border-brand-ink focus:border-brand-ink focus:ring-2 focus:ring-brand-ink/10"
                >
                  {supportedLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-muted" aria-hidden="true" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isAuthPage && authUser ? (
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-muted hover:bg-neutral-light hover:text-error transition-colors"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            <div className="hidden md:block">
              <LoginMenu />
            </div>
          )}
          <button
            className="lg:hidden p-2 text-neutral-text hover:bg-neutral-light rounded-full transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-surface-canvas border-b border-neutral-light">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-text hover:bg-brand-ink hover:text-surface-canvas transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {authIsAdmin ? item.label : <BilingualText english={item.label} />}
              </Link>
            ))}
            {!authIsAdmin && (
              <div className="pt-4 border-t border-neutral-light">
                <label htmlFor="mobile-language" className="mb-2 block text-xs font-medium uppercase text-neutral-muted"><BilingualText english="Language" /></label>
                <div className="relative">
                  <select
                    id="mobile-language"
                    value={language}
                    onChange={(event) => {
                      setLanguage(event.target.value);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full appearance-none rounded-xl border border-neutral-light bg-white px-4 py-3 pr-10 text-sm font-semibold text-neutral-text outline-none transition focus:border-brand-ink focus:ring-2 focus:ring-brand-ink/10"
                  >
                    {supportedLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-muted" aria-hidden="true" />
                </div>
              </div>
            )}
            {authUser ? (
              <button
                onClick={handleLogout}
                className="hidden items-center gap-3 px-4 py-3 rounded-xl text-neutral-muted hover:bg-neutral-light transition-colors"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            ) : (
              <LoginMenu variant="mobile" onNavigate={() => setMobileMenuOpen(false)} />
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
