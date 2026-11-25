import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight, CheckCircle2, Clock3, FileText, MapPin, MessageCircle,
  Plus, SlidersHorizontal, Sparkles, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { complaintAPI } from '../../services/api';
import { getMyLocalComplaints } from '../../services/localComplaints';
import { isLocalDemoMode } from '../../config/authMode';
import { COMPLAINT_CATEGORY_LABELS, getCitizenComplaintCategoryLabel } from '../../utils/complaintCategory';
import AIChatPanel from '../../components/ai/AIChatPanel';
import BilingualText from '../../components/i18n/BilingualText';
import dashboardBackground from '../../assets/images/citizen-dashboard-background.webp';
import dashboardGirl from '../../assets/images/citizen-dashboard-girl.webp';

const STATUS_LABELS = {
  pending: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Closed',
};

const STATUS_STYLES = {
  pending: 'bg-saffron-light/60 text-neutral-text',
  assigned: 'bg-info/10 text-info',
  in_progress: 'bg-brand-ink/10 text-brand-ink',
  resolved: 'bg-success/10 text-success',
  rejected: 'bg-neutral-light text-neutral-muted',
};

const formatDate = (value, language) => {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
};

const normalizeComplaint = (complaint) => ({
  ...complaint,
  description: complaint.englishDescription || complaint.description,
  reference: complaint.referenceNumber || complaint.reference_number,
  location: complaint.locationAddress || complaint.location_address,
  created: complaint.createdAt || complaint.created_at,
  messageCount: complaint.messages?.filter((message) => message.authorRole === 'staff').length || 0,
});

const EMPTY_FILTERS = {
  fromDate: '',
  toDate: '',
  categories: [],
  statuses: [],
  progressMin: 0,
  progressMax: 100,
};

const CITIZEN_STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['assigned', 'Assigned'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['rejected', 'Closed'],
];

export default function CitizenDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');

    if (isLocalDemoMode) {
      try {
        let localComplaints = getMyLocalComplaints(user.id).map(normalizeComplaint);
        if (appliedFilters.fromDate) {
          localComplaints = localComplaints.filter((item) => new Date(item.created) >= new Date(`${appliedFilters.fromDate}T00:00:00`));
        }
        if (appliedFilters.toDate) {
          localComplaints = localComplaints.filter((item) => new Date(item.created) < new Date(`${appliedFilters.toDate}T00:00:00`).setDate(new Date(`${appliedFilters.toDate}T00:00:00`).getDate() + 1));
        }
        if (appliedFilters.categories.length) {
          localComplaints = localComplaints.filter((item) => appliedFilters.categories.includes(item.category));
        }
        if (appliedFilters.statuses.length) {
          localComplaints = localComplaints.filter((item) => appliedFilters.statuses.includes(item.status));
        }
        if (appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100) {
          localComplaints = localComplaints.filter((item) => {
            const updates = item.progress_updates || [];
            if (!updates.length) return false;
            const latest = updates[updates.length - 1];
            const progress = Number(latest.progress_percentage);
            return Number.isInteger(progress)
              && progress >= appliedFilters.progressMin
              && progress <= appliedFilters.progressMax;
          });
        }
        setComplaints(localComplaints);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load your local reports.');
      } finally {
        setIsLoading(false);
      }
      return () => { active = false; };
    }

    const params = {
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

    complaintAPI.getMyComplaints(params)
      .then(({ data }) => {
        if (active) setComplaints(data.complaints.map(normalizeComplaint));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || 'Unable to load your reports. Check your connection and try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [appliedFilters, retryToken, user.id]);

  const stats = useMemo(() => [
    { label: 'Total reports', value: complaints.length, icon: FileText, style: 'bg-brand-ink/5 text-brand-ink' },
    { label: 'In progress', value: complaints.filter((item) => ['assigned', 'in_progress'].includes(item.status)).length, icon: Clock3, style: 'bg-info/5 text-info' },
    { label: 'Resolved', value: complaints.filter((item) => item.status === 'resolved').length, icon: CheckCircle2, style: 'bg-success/5 text-success' },
  ], [complaints]);

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
    setDraftFilters((current) => ({
      ...current,
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    }));
  };

  const activeFilterCount = [
    appliedFilters.fromDate,
    appliedFilters.toDate,
    appliedFilters.categories.length,
    appliedFilters.statuses.length,
    appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100,
  ].filter(Boolean).length;
  const translate = (english) => t(english, { defaultValue: english, keySeparator: false });

  const receivedComplaints = complaints.filter((complaint) => complaint.status !== 'resolved');
  const resolvedComplaints = complaints.filter((complaint) => complaint.status === 'resolved');

  return (
    <div className="relative isolate min-h-screen pb-14 text-neutral-text">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img src={dashboardBackground} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[#fff8e9]/10" />
      </div>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-3xl bg-brand-ink-dark/85 px-6 py-7 text-surface-canvas shadow-premium sm:px-9 sm:py-9"
        >
          <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-saffron/10 blur-2xl" aria-hidden="true" />
          <div className="relative z-10 flex flex-col justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <span className="mb-3 inline-flex rounded-full border border-white/20 bg-success/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                <BilingualText english="User" />
              </span>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-saffron">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> <BilingualText english="Your community, your voice" />
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-surface-canvas sm:text-4xl">
                <BilingualText english="Welcome, {{name}}." values={{ name: user?.name?.split(' ')[0] || 'Citizen' }} />
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-surface-canvas/75">
                <BilingualText english="Explore your community, report local issues, and follow every update." />
              </p>
              <Link to="/report" className="mt-6 inline-flex items-center gap-2 rounded-full bg-saffron px-5 py-3 text-sm font-bold text-brand-ink transition hover:-translate-y-0.5 hover:bg-saffron-light">
                <Plus className="h-4 w-4" aria-hidden="true" /> <BilingualText english="Report an issue" />
              </Link>
            </div>
            <div className="relative h-[220px] w-full sm:h-[250px] md:h-[270px] md:w-[420px] md:shrink-0">
              <img
                src={dashboardGirl}
                alt="A welcoming illustrated girl"
                loading="eager"
                decoding="async"
                className="absolute bottom-[-20px] right-0 z-10 h-[270px] w-auto object-contain object-bottom sm:bottom-[-24px] sm:h-[310px] md:bottom-[-30px] md:h-[340px]"
              />
            </div>
          </div>
        </motion.section>

        {isLocalDemoMode && (
          <div className="mb-7 rounded-2xl border border-saffron-muted/25 bg-saffron-light/20 px-5 py-4 text-sm text-neutral-text">
            <strong><BilingualText english="Prototype mode." /></strong>{' '}
            <BilingualText english="Your reports, updates, and questions are stored in this browser." />
          </div>
        )}

        <div className="mb-5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="citizen-complaint-filters"
            aria-label={translate('Open filters')}
            title={translate(filtersOpen ? 'Close filters' : 'Open filters')}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition ${filtersOpen ? 'border-brand-ink bg-brand-ink text-white' : 'border-neutral-light bg-surface-card text-neutral-muted hover:border-brand-ink hover:text-brand-ink'}`}
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#f4f8f3] bg-saffron px-1 text-[10px] font-bold text-brand-ink">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <section id="citizen-complaint-filters" aria-label={translate('Complaint filters')} className="mb-8 rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink/5 text-brand-ink">
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-brand-ink"><BilingualText english="Filter your reports" /></h2>
                <p className="text-xs text-neutral-muted"><BilingualText english="Combine filters to search only your complaints." /></p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-semibold text-neutral-text">
                <BilingualText english="From date" />
                <input type="date" value={draftFilters.fromDate} onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-ink" />
              </label>
              <label className="text-xs font-semibold text-neutral-text">
                <BilingualText english="To date" />
                <input type="date" value={draftFilters.toDate} onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-ink" />
              </label>
              <div className="text-xs font-semibold text-neutral-text md:col-span-2">
                <BilingualText english="Quick date range" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setDraftFilters((current) => ({ ...current, fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10) }))} className="rounded-full border border-neutral-light bg-white px-3 py-2 text-xs text-neutral-text hover:border-brand-ink"><BilingualText english="Today" /></button>
                  <button type="button" onClick={() => setQuickDate(7)} className="rounded-full border border-neutral-light bg-white px-3 py-2 text-xs text-neutral-text hover:border-brand-ink"><BilingualText english="7 days" /></button>
                  <button type="button" onClick={() => setQuickDate(30)} className="rounded-full border border-neutral-light bg-white px-3 py-2 text-xs text-neutral-text hover:border-brand-ink"><BilingualText english="30 days" /></button>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-text"><BilingualText english="Category" /></legend>
                <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-xl border border-neutral-light p-3">
                  {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => toggleDraftList('categories', value)} className={`rounded-full border px-3 py-1.5 text-xs transition ${draftFilters.categories.includes(value) ? 'border-brand-ink bg-brand-ink text-white' : 'border-neutral-light bg-white text-neutral-text hover:border-brand-ink'}`}>
                      <BilingualText english={label} />
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-neutral-text"><BilingualText english="Status" /></legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CITIZEN_STATUS_OPTIONS.map(([value, label]) => (
                    <button key={value} type="button" onClick={() => toggleDraftList('statuses', value)} className={`rounded-full border px-3 py-2 text-xs transition ${draftFilters.statuses.includes(value) ? 'border-brand-ink bg-brand-ink text-white' : 'border-neutral-light bg-white text-neutral-text hover:border-brand-ink'}`}>
                      <BilingualText english={label} />
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-text">
                    <span><BilingualText english="Recorded progress" /></span>
                    <span>{draftFilters.progressMin}% - {draftFilters.progressMax}%</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] text-neutral-muted">
                      <BilingualText english="Minimum" />
                      <input type="range" min="0" max="100" value={draftFilters.progressMin} onChange={(event) => setDraftFilters((current) => ({ ...current, progressMin: Math.min(Number(event.target.value), current.progressMax) }))} className="mt-1 w-full accent-brand-ink" />
                    </label>
                    <label className="text-[11px] text-neutral-muted">
                      <BilingualText english="Maximum" />
                      <input type="range" min="0" max="100" value={draftFilters.progressMax} onChange={(event) => setDraftFilters((current) => ({ ...current, progressMax: Math.max(Number(event.target.value), current.progressMin) }))} className="mt-1 w-full accent-brand-ink" />
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-muted"><BilingualText english="Only complaints with a recorded progress update are included in a progress range." /></p>
                </div>
              </fieldset>
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-light pt-4">
                <span className="mr-1 text-xs font-semibold text-neutral-muted"><BilingualText english="Applied:" /></span>
                {appliedFilters.fromDate && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink"><BilingualText english="From:" /> {appliedFilters.fromDate}</span>}
                {appliedFilters.toDate && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink"><BilingualText english="To:" /> {appliedFilters.toDate}</span>}
                {appliedFilters.categories.map((value) => <span key={value} className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink"><BilingualText english={getCitizenComplaintCategoryLabel(value)} /></span>)}
                {appliedFilters.statuses.map((value) => <span key={value} className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink"><BilingualText english={STATUS_LABELS[value]} /></span>)}
                {(appliedFilters.progressMin > 0 || appliedFilters.progressMax < 100) && <span className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs text-brand-ink"><BilingualText english="Progress:" /> {appliedFilters.progressMin}% - {appliedFilters.progressMax}%</span>}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-full border border-neutral-light bg-white px-5 py-2.5 text-sm font-semibold text-neutral-text hover:border-error/30 hover:text-error">
                <X className="h-4 w-4" aria-hidden="true" /> <BilingualText english="Clear Filters" />
              </button>
              <button type="button" onClick={applyFilters} className="rounded-full bg-brand-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-ink-dark">
                <BilingualText english="Apply Filters" />
              </button>
            </div>
          </section>
        )}

        <section aria-label={translate('Your report summary')} className="mb-8 grid gap-4 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <motion.article
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-2xl border border-neutral-light bg-surface-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-muted"><BilingualText english={stat.label} /></p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.style}`}>
                  <stat.icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-brand-ink">
                {isLoading ? '—' : error ? '—' : stat.value}
              </p>
            </motion.article>
          ))}
        </section>

        {!isLocalDemoMode && (
          <div className="mb-8">
            <AIChatPanel title="Ask Gramamitra" bilingual />
          </div>
        )}

        <section aria-label={translate('Your complaint status lists')}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-ink"><BilingualText english="Your reports" /></h2>
              <p className="mt-1 text-xs text-neutral-muted"><BilingualText english="Received reports appear separately from resolved reports." /></p>
            </div>
            <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="rounded-full px-4 py-2 text-xs font-bold text-brand-ink transition hover:bg-brand-ink/5">
              <BilingualText english="Refresh" />
            </button>
          </div>

          {isLoading && <p role="status" className="rounded-3xl border border-neutral-light bg-surface-card px-6 py-12 text-center text-sm text-neutral-muted"><BilingualText english="Loading your reports…" /></p>}
          {!isLoading && error && (
            <div role="alert" className="rounded-2xl border border-error/20 bg-error/5 p-5 text-sm text-error">
              <p>{error}</p>
              <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="mt-3 font-bold underline"><BilingualText english="Try again" /></button>
            </div>
          )}
          {!isLoading && !error && (
            <div className="grid gap-5 lg:grid-cols-2">
              {[
                { title: 'Received reports', tone: 'border-[#f3d0ac] bg-[#fff7ed]', list: receivedComplaints },
                { title: 'Resolved reports', tone: 'border-[#cce4d2] bg-[#f2faf4]', list: resolvedComplaints },
              ].map((column) => (
                <div key={column.title} className={`min-w-0 overflow-hidden rounded-3xl border shadow-card ${column.tone}`}>
                  <div className="flex items-center justify-between border-b border-black/5 px-5 py-5 sm:px-6">
                    <h3 className="font-display text-lg font-bold text-brand-ink"><BilingualText english={column.title} /></h3>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-brand-ink">{column.list.length}</span>
                  </div>
                  {column.list.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <FileText className="mx-auto h-7 w-7 text-neutral-muted/50" aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-brand-ink">
                        <BilingualText english={activeFilterCount > 0 ? 'No matching reports' : `No ${column.title === 'Received reports' ? 'received' : 'resolved'} reports yet`} />
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-black/5">
                      {column.list.map((complaint, index) => (
                        <motion.li key={complaint.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.2) }}>
                          <Link to={`/complaints/${complaint.id}`} className="group flex flex-col gap-4 px-5 py-5 transition hover:bg-white/55 sm:px-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLES[complaint.status] || 'bg-neutral-light text-neutral-muted'}`}><BilingualText english={STATUS_LABELS[complaint.status] || complaint.status} /></span>
                                <span className="font-mono text-[11px] text-neutral-muted">{complaint.reference}</span>
                              </div>
                              <ArrowUpRight className="h-4 w-4 text-neutral-muted transition group-hover:text-brand-ink" aria-hidden="true" />
                            </div>
                            <h3 className="truncate font-semibold text-neutral-text group-hover:text-brand-ink"><BilingualText english={getCitizenComplaintCategoryLabel(complaint.category)} /></h3>
                            <p className="line-clamp-2 text-sm text-neutral-muted">{complaint.description}</p>
                            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-muted">
                              <span>{formatDate(complaint.created, language)}</span>
                              {complaint.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{complaint.location}</span>}
                            </p>
                            {complaint.messageCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {complaint.messageCount} <BilingualText english={complaint.messageCount === 1 ? 'reply' : 'replies'} /></span>
                            )}
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 max-w-2xl">
          <Link to="/report" className="group flex items-center justify-between rounded-2xl border border-neutral-light bg-surface-card p-5 transition hover:-translate-y-0.5 hover:border-brand-ink/30 hover:shadow-card">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink/5 text-brand-ink"><Plus className="h-5 w-5" aria-hidden="true" /></span>
              <span><strong className="block text-sm"><BilingualText english="Report a new issue" /></strong><span className="text-xs text-neutral-muted"><BilingualText english="Photos, location pin, and details" /></span></span>
            </span>
            <ArrowUpRight className="h-4 w-4 text-neutral-muted transition group-hover:text-brand-ink" aria-hidden="true" />
          </Link>
        </div>
      </main>
    </div>
  );
}
