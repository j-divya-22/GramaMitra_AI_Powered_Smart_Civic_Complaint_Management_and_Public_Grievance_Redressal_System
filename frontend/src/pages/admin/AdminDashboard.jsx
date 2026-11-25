import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowUpRight, Building2, CheckCircle2, ClipboardList,
  Clock3, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users, X,
} from 'lucide-react';
import { adminAPI, complaintAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COMPLAINT_CATEGORY_LABELS, getComplaintCategoryLabel } from '../../utils/complaintCategory';
import { formatCnnConfidence } from '../../utils/cnnConfidence';
import AIChatPanel from '../../components/ai/AIChatPanel';

const STATUS_LABELS = {
  pending: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Closed',
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
  : 'Recently';

const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['assigned', 'Assigned'],
  ['in_progress', 'In Progress'],
  ['resolved', 'Resolved'],
  ['rejected', 'Closed'],
];

const EMPTY_FILTERS = {
  citizen: '',
  fromDate: '',
  toDate: '',
  categories: [],
  statuses: [],
  progressMin: 0,
  progressMax: 100,
};

const reportCategoryLabel = (report) => getComplaintCategoryLabel(report.category);

const reportCnnPredictionSummary = (report) => (report.evidence_files || [])
  .filter((file) => file.cnn_category)
  .map((file) => (
    `${getComplaintCategoryLabel(file.cnn_category)} · ${formatCnnConfidence(file.cnn_confidence)}`
  ))
  .join('; ');

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const params = {
      page: 1,
      limit: 20,
      citizen: appliedFilters.citizen.trim() || undefined,
      from_date: appliedFilters.fromDate || undefined,
      to_date: appliedFilters.toDate || undefined,
      category: appliedFilters.categories.join(',') || undefined,
      status: appliedFilters.statuses.join(',') || undefined,
      progress_min: appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100
        ? appliedFilters.progressMin
        : undefined,
      progress_max: appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100
        ? appliedFilters.progressMax
        : undefined,
    };

    Promise.all([adminAPI.getStats(params), complaintAPI.getAll(params)])
      .then(([statsResponse, complaintsResponse]) => {
        if (!active) return;
        setStats(statsResponse.data);
        setReports(complaintsResponse.data.complaints || []);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.error || 'Could not load the admin workspace. Check the backend connection and try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [appliedFilters, retryToken]);

  const visibleReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((report) => !term || [
      report.reference_number,
      getComplaintCategoryLabel(report.category),
      ...(report.evidence_files || []).map((file) => getComplaintCategoryLabel(file.cnn_category)),
      report.citizen_name,
      report.location_address,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [reports, search]);

  const toggleDraftList = (field, value) => {
    setDraftFilters((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  };

  const applyFilters = () => {
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.fromDate > draftFilters.toDate) {
      setError('From Date cannot be later than To Date.');
      return;
    }
    setError('');
    setAppliedFilters({
      ...draftFilters,
      citizen: draftFilters.citizen.trim(),
      categories: [...draftFilters.categories],
      statuses: [...draftFilters.statuses],
    });
  };

  const clearFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS, categories: [], statuses: [] });
    setAppliedFilters({ ...EMPTY_FILTERS, categories: [], statuses: [] });
  };

  const setQuickDate = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const toIso = to.toISOString().slice(0, 10);
    const fromIso = from.toISOString().slice(0, 10);
    setDraftFilters((current) => ({ ...current, fromDate: fromIso, toDate: toIso }));
  };

  const activeFilterCount = [
    appliedFilters.citizen,
    appliedFilters.fromDate,
    appliedFilters.toDate,
    appliedFilters.categories.length,
    appliedFilters.statuses.length,
    appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100,
  ].filter(Boolean).length;

  const cards = [
    { label: 'Total reports', value: stats?.total, icon: ClipboardList, tone: 'bg-brand-ink/5 text-brand-ink' },
    { label: 'Awaiting action', value: stats?.pending, icon: Clock3, tone: 'bg-saffron-light/50 text-warning' },
    { label: 'Assigned', value: stats?.assigned, icon: Users, tone: 'bg-info/5 text-info' },
    { label: 'Resolved', value: stats?.resolved, icon: CheckCircle2, tone: 'bg-success/5 text-success' },
  ];

  const receivedReports = visibleReports.filter((report) => report.status !== 'resolved');
  const resolvedReports = visibleReports.filter((report) => report.status === 'resolved');

  return (
    <div className="min-h-screen bg-[#f2f4f7] pb-14">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#fce6da] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#ad4f1b]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Admin
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[#27334f] sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-[#626b7d]">Welcome, {user?.name || 'Administrator'}. Manage community reports and activities.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="admin-complaint-filters"
              title={filtersOpen ? 'Close filters' : 'Open filters'}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition ${filtersOpen ? 'border-brand-ink bg-brand-ink text-white' : 'border-[#dfe2e8] bg-white text-[#626b7d] hover:border-brand-ink hover:text-brand-ink'}`}
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#f2f4f7] bg-[#ad4f1b] px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </motion.header>

        {error && (
          <div role="alert" className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-error/20 bg-error/5 p-5 text-sm text-error">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
            <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {filtersOpen && (
        <section id="admin-complaint-filters" aria-label="Complaint filters" className="mb-8 rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink/5 text-brand-ink">
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-brand-ink">Filter complaints</h2>
                <p className="text-xs text-neutral-muted">Combine filters to refine the dashboard.</p>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-[#fce6da] px-3 py-1 text-xs font-bold text-[#ad4f1b]">
                {activeFilterCount} active
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-neutral-text">
              Citizen name or email
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={draftFilters.citizen}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, citizen: event.target.value }))}
                  placeholder="Search citizen"
                  className="w-full rounded-xl border border-neutral-light bg-white py-2.5 pl-9 pr-3 text-sm font-normal outline-none focus:border-brand-ink"
                />
              </div>
            </label>

            <label className="text-xs font-semibold text-neutral-text">
              From date
              <input
                type="date"
                value={draftFilters.fromDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-ink"
              />
            </label>

            <label className="text-xs font-semibold text-neutral-text">
              To date
              <input
                type="date"
                value={draftFilters.toDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-ink"
              />
            </label>

            <div className="text-xs font-semibold text-neutral-text">
              Quick date range
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setDraftFilters((current) => ({ ...current, fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10) }))} className="rounded-full border border-neutral-light bg-white px-3 py-2 text-xs text-neutral-text hover:border-brand-ink">Today</button>
                <button type="button" onClick={() => setQuickDate(7)} className="rounded-full border border-neutral-light bg-white px-3 py-2 text-xs text-neutral-text hover:border-brand-ink">7 days</button>
                <button type="button" onClick={() => setQuickDate(30)} className="rounded-full border border-neutral-light bg-white px-3 py-2 text-xs text-neutral-text hover:border-brand-ink">30 days</button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <fieldset>
              <legend className="text-xs font-semibold text-neutral-text">Category</legend>
              <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-xl border border-neutral-light p-3">
                {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => toggleDraftList('categories', value)} className={`rounded-full border px-3 py-1.5 text-xs transition ${draftFilters.categories.includes(value) ? 'border-brand-ink bg-brand-ink text-white' : 'border-neutral-light bg-white text-neutral-text hover:border-brand-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-neutral-text">Status</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(([value, label]) => (
                  <button key={value} type="button" onClick={() => toggleDraftList('statuses', value)} className={`rounded-full border px-3 py-2 text-xs transition ${draftFilters.statuses.includes(value) ? 'border-brand-ink bg-brand-ink text-white' : 'border-neutral-light bg-white text-neutral-text hover:border-brand-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-text">
                  <span>Recorded progress</span>
                  <span>{draftFilters.progressMin}% - {draftFilters.progressMax}%</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[11px] text-neutral-muted">
                    Minimum
                    <input type="range" min="0" max="100" value={draftFilters.progressMin} onChange={(event) => setDraftFilters((current) => ({ ...current, progressMin: Math.min(Number(event.target.value), current.progressMax) }))} className="mt-1 w-full accent-brand-ink" />
                  </label>
                  <label className="text-[11px] text-neutral-muted">
                    Maximum
                    <input type="range" min="0" max="100" value={draftFilters.progressMax} onChange={(event) => setDraftFilters((current) => ({ ...current, progressMax: Math.max(Number(event.target.value), current.progressMin) }))} className="mt-1 w-full accent-brand-ink" />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-neutral-muted">Only complaints with a recorded progress update are included in a progress range.</p>
              </div>
            </fieldset>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-light pt-4">
              <span className="mr-1 text-xs font-semibold text-neutral-muted">Applied:</span>
              {appliedFilters.citizen && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink">Citizen: {appliedFilters.citizen}</span>}
              {appliedFilters.fromDate && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink">From: {appliedFilters.fromDate}</span>}
              {appliedFilters.toDate && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink">To: {appliedFilters.toDate}</span>}
              {appliedFilters.categories.map((value) => <span key={value} className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink">{getComplaintCategoryLabel(value)}</span>)}
              {appliedFilters.statuses.map((value) => <span key={value} className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink">{STATUS_LABELS[value]}</span>)}
              {(appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100) && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink">Progress: {appliedFilters.progressMin}% - {appliedFilters.progressMax}%</span>}
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-full border border-neutral-light bg-white px-5 py-2.5 text-sm font-semibold text-neutral-text hover:border-error/30 hover:text-error">
              <X className="h-4 w-4" aria-hidden="true" /> Clear Filters
            </button>
            <button type="button" onClick={applyFilters} className="rounded-full bg-brand-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-ink-dark">
              Apply Filters
            </button>
          </div>
        </section>
        )}

        <section aria-label="Complaint statistics" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => (
            <motion.article
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-2xl border border-[#e4e6eb] bg-[#fffdfa] p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#626b7d]">{card.label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                  <card.icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-brand-ink">{loading || error ? '—' : (card.value ?? '—')}</p>
            </motion.article>
          ))}
        </section>

        <div className="mb-8">
          <AIChatPanel title="Ask about the complaint database" />
        </div>

        <section aria-label="Complaint status lists">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-ink">Complaint reports</h2>
              <p className="mt-1 text-xs text-neutral-muted">Received reports are separated from resolved reports.</p>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-muted" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" className="w-full rounded-full border border-neutral-light bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-ink" />
            </label>
          </div>

          {loading && <p role="status" className="rounded-3xl border border-neutral-light bg-surface-card px-6 py-12 text-center text-sm text-neutral-muted">Loading live complaint data…</p>}
          {!loading && !error && (
            <div className="grid gap-5 lg:grid-cols-2">
              {[
                { title: 'Received reports', tone: 'border-[#f3d0ac] bg-[#fff7ed]', list: receivedReports },
                { title: 'Resolved reports', tone: 'border-[#cce4d2] bg-[#f2faf4]', list: resolvedReports },
              ].map((column) => (
                <div key={column.title} className={`min-w-0 overflow-hidden rounded-3xl border shadow-card ${column.tone}`}>
                  <div className="flex items-center justify-between border-b border-black/5 px-5 py-5 sm:px-6">
                    <h3 className="font-display text-lg font-bold text-brand-ink">{column.title}</h3>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-brand-ink">{column.list.length}</span>
                  </div>
                  {column.list.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <Building2 className="mx-auto h-7 w-7 text-neutral-muted/50" aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-brand-ink">
                        {reports.length || activeFilterCount > 0 ? 'No matching reports' : `No ${column.title.toLowerCase()} yet`}
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-black/5">
                      {column.list.map((report) => {
                        const cnnPredictionSummary = reportCnnPredictionSummary(report);
                        return (
                          <li key={report.id}>
                            <Link to={`/complaints/${report.id}`} className="group flex flex-col gap-4 px-5 py-5 transition hover:bg-white/55 sm:px-6">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[#fce6da] px-3 py-1 text-[11px] font-bold text-[#ad4f1b]">{STATUS_LABELS[report.status] || report.status}</span>
                                  <span className="font-mono text-[11px] text-neutral-muted">{report.reference_number}</span>
                                </div>
                                <ArrowUpRight className="h-4 w-4 text-neutral-muted transition group-hover:text-brand-ink" aria-hidden="true" />
                              </div>
                              <h3 className="truncate font-semibold text-neutral-text group-hover:text-brand-ink">{reportCategoryLabel(report)} <span className="font-normal text-neutral-muted">· {report.citizen_name || 'Citizen'}</span></h3>
                              {cnnPredictionSummary && <p className="text-xs text-neutral-muted">CNN prediction: {cnnPredictionSummary}</p>}
                              <p className="truncate text-sm text-neutral-muted">{report.location_address}</p>
                              <p className="text-xs text-neutral-muted">Submitted {formatDate(report.created_at)}</p>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
