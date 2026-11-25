import { ChevronDown, LogIn, Shield, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import BilingualText from '../i18n/BilingualText';

export default function LoginMenu({ variant = 'navbar', onNavigate }) {
  const isMobile = variant === 'mobile';
  const isLanding = variant === 'landing';

  const triggerClass = isLanding
    ? 'rounded-full border border-brand-ink/15 bg-surface-card/90 px-5 py-3 text-brand-ink shadow-card hover:bg-white'
    : isMobile
      ? 'w-full justify-between rounded-xl border border-neutral-light bg-white px-4 py-3 text-neutral-text'
      : 'rounded-full px-5 py-2 text-neutral-text hover:bg-neutral-light';

  const menuClass = isMobile
    ? 'relative mt-2 w-full'
    : 'absolute right-0 top-full mt-2 w-60';

  const linkClass = 'flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-neutral-text transition hover:bg-brand-ink/5 hover:text-brand-ink';

  return (
    <details className={`group relative ${isMobile ? 'block w-full' : 'inline-block'}`}>
      <summary className={`flex cursor-pointer list-none items-center gap-2 text-sm font-semibold transition-colors ${triggerClass}`}>
        <span className="inline-flex items-center gap-2">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          <BilingualText english="Login" />
        </span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className={`${menuClass} z-[60] rounded-2xl border border-neutral-light bg-white p-2 shadow-premium`}>
        <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-muted">
          <BilingualText english="Choose your account" />
        </p>
        <Link to="/login" onClick={onNavigate} className={linkClass}>
          <User className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span><BilingualText english="Citizen / User login" /></span>
        </Link>
        <Link to="/admin/login" onClick={onNavigate} className={linkClass}>
          <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span><BilingualText english="Administrator login" /></span>
        </Link>
      </div>
    </details>
  );
}
