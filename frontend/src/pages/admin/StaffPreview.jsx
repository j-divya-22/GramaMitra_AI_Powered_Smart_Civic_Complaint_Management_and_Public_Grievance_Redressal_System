import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, ClipboardList, Clock3, Search, ShieldCheck } from 'lucide-react';
import { getLocalComplaints } from '../../services/localComplaints';
import { isLocalDemoMode } from '../../config/authMode';

const STATUS_FILTERS = [
  { value: 'all', label: 'All reports' },
  { value: 'pending', label: 'Received' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_LABELS = {
  pending: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Closed',
};

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

export default function StaffPreview() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [reports, setReports] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    try {
      setReports(getLocalComplaints().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load local demo reports.');
    }
  }, [refreshToken]);

  const visibleReports = reports.filter((report) => {
    const matchesStatus = filter === 'all' || report.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [
      report.referenceNumber,
      report.category,
      report.citizenName,
      report.locationAddress,
    ].some((value) => value?.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  if (!isLocalDemoMode) return null;

  const pendingCount = reports.filter((report) => ['pending', 'assigned', 'in_progress'].includes(report.status)).length;
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length;
  const questionCount = reports.reduce((total, report) => total + report.messages.filter((message) => message.authorRole === 'citizen').length, 0);

  return (
    <div className="min-h-screen bg-surface-canvas pb-14">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div role="status" className="mb-7 flex items-start gap-3 rounded-2xl border border-saffron-muted/30 bg-saffron-light/25 p-4 text-sm text-neutral-text">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
          <p><strong>Frontend staff preview.</strong> Anyone using this browser can access this screen. Reports, messages, and updates are local demo data—not real administration.</p>
        </div>

        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron-muted">Gramamitra · Staff view</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-brand-ink sm:text-4xl">Community reports</h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-muted">Review a report, post progress, and reply to citizen questions in the prototype.</p>
          </div>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="rounded-full border border-neutral-light bg-surface-card px-5 py-3 text-sm font-semibold text-brand-ink transition hover:border-brand-ink/40">
            Refresh reports
          </button>
        </motion.header>

        {loadError && <p role="alert" className="mb-6 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">{loadError}</p>}

        <section aria-label="Staff report summary" className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total reports', value: reports.length, icon: ClipboardList },
            { label: 'Need attention', value: pendingCount, icon: Clock3 },
            { label: 'Citizen questions', value: questionCount, icon: Search },
          ].map((stat, index) => (
            <motion.article
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-2xl border border-neutral-light bg-surface-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-muted">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-saffron-muted" aria-hidden="true" />
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-brand-ink">{stat.value}</p>
            </motion.article>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="flex flex-col gap-4 border-b border-neutral-light p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-ink">Report inbox</h2>
                <p className="mt-1 text-xs text-neutral-muted">{resolvedCount} resolved in this browser</p>
              </div>
              <label className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-muted" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" className="w-full rounded-full border border-neutral-light bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-ink" />
              </label>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={filter === item.value}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                    filter === item.value ? 'bg-brand-ink text-white' : 'bg-white text-neutral-muted hover:bg-neutral-light'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {!loadError && visibleReports.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <ClipboardList className="mx-auto h-9 w-9 text-neutral-muted/50" aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-bold text-brand-ink">{reports.length ? 'No matching reports' : 'Your inbox is ready'}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-muted">
                {reports.length ? 'Try another search or status filter.' : 'Create a report from the citizen dashboard to try out status updates and two-way messages.'}
              </p>
              {!reports.length && <Link to="/report" className="btn-primary mt-6 inline-flex !px-5 !py-3 !text-sm">Create a demo report</Link>}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-light">
              {visibleReports.map((report) => {
                const questions = report.messages.filter((message) => message.authorRole === 'citizen').length;
                return (
                  <li key={report.id} className="px-5 py-5 transition hover:bg-white/50 sm:px-6">
                    <Link to={`/staff-preview/complaints/${report.id}`} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs font-bold text-brand-ink">{STATUS_LABELS[report.status] || report.status}</span>
                          {questions > 0 && <span className="rounded-full bg-saffron-light/60 px-3 py-1 text-xs font-bold text-neutral-text">{questions} citizen {questions === 1 ? 'question' : 'questions'}</span>}
                        </div>
                        <h3 className="truncate font-semibold text-neutral-text">{report.category} <span className="font-normal text-neutral-muted">· {report.citizenName}</span></h3>
                        <p className="mt-1 truncate text-sm text-neutral-muted">{report.locationAddress}</p>
                        <p className="mt-2 font-mono text-[11px] text-neutral-muted">{report.referenceNumber} · Updated {formatDate(report.updatedAt)}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-brand-ink">
                        Review report <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
