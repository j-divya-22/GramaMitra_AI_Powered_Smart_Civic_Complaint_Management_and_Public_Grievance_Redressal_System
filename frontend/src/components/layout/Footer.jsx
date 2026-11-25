import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BilingualText from '../i18n/BilingualText';

const CITIZEN_FOOTER_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/report', label: 'Report an issue' },
  { to: '/voice-assistant', label: 'Voice assistant' },
];

export default function Footer() {
  const { isAdmin } = useAuth();
  const footerLinks = isAdmin
    ? [{ to: '/admin', label: 'Admin dashboard' }]
    : CITIZEN_FOOTER_LINKS;

  return (
    <footer className="border-t border-neutral-light bg-brand-ink-dark text-surface-canvas">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/assets/images/logo.png" alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-display text-sm font-bold">Gramamitra <span className="ml-1 text-xs font-normal text-surface-canvas/60">ग्राममित्र</span></p>
            <p className="mt-0.5 text-xs text-surface-canvas/60">{isAdmin ? 'Every voice matters.' : <BilingualText english="Every voice matters." />}</p>
          </div>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-surface-canvas/70">
          {footerLinks.map((item) => (
            <Link key={item.to} to={item.to} className="transition hover:text-saffron">
              {isAdmin ? item.label : <BilingualText english={item.label} />}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-surface-canvas/55">© {new Date().getFullYear()} Gramamitra</p>
      </div>
    </footer>
  );
}
