import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowUpRight, Building2, CheckCircle2, Clock3,
  MapPinned, RefreshCw, RotateCcw, X,
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { getComplaintCategoryLabel } from '../../utils/complaintCategory';

const RegionalMap = lazy(() => import('../../components/regional/RegionalMap'));

const statusLabel = (status) => ({
  pending: 'Received',
  Submitted: 'Received',
  submitted: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Closed',
}[status] || status || 'Unknown');

const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
  : 'Recently';

const initialFilters = {
  regionLevel: '',
  region: '',
  district: '',
  city: '',
  taluk: '',
  village: '',
  ward: '',
  locality: '',
  category: '',
  status: '',
  fromDate: '',
  toDate: '',
};

export default function RegionalInsights() {
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [regionalOptions, setRegionalOptions] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminAPI.getRegionalOptions({ level: 'district' }),
      adminAPI.getRegionalOptions({ level: 'city' }),
      adminAPI.getRegionalOptions({ level: 'taluk' }),
      adminAPI.getRegionalOptions({ level: 'village' }),
      adminAPI.getRegionalOptions({ level: 'gram_panchayat' }),
      adminAPI.getRegionalOptions({ level: 'ward' }),
      adminAPI.getRegionalOptions({ level: 'locality' }),
    ])
      .then((responses) => {
        if (!active) return;
        setRegionalOptions({
          district: responses[0].data.options || [],
          city: responses[1].data.options || [],
          taluk: responses[2].data.options || [],
          village: responses[3].data.options || [],
          gram_panchayat: responses[4].data.options || [],
          ward: responses[5].data.options || [],
          locality: responses[6].data.options || [],
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || 'Could not load regional options.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    const params = {
      region_level: filters.regionLevel || undefined,
      region: filters.region || undefined,
      district: filters.district || undefined,
      city: filters.city || undefined,
      taluk: filters.taluk || undefined,
      village: filters.village || undefined,
      ward: filters.ward || undefined,
      locality: filters.locality || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
      from_date: filters.fromDate || undefined,
      to_date: filters.toDate || undefined,
    };
    adminAPI.getRegionalInsights(params)
      .then(({ data: response }) => {
        if (active) setData(response);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || 'Could not load regional insights.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters, retryToken]);

  const categoryOptions = useMemo(() => (
    data?.categories?.map((item) => item.category).filter((category) => typeof category === 'string') || []
  ), [data]);

  const applyFilters = () => {
    if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
      setError('From Date cannot be later than To Date.');
      return;
    }
    setError('');
    setFilters({ ...draft });
  };

  const resetFilters = () => {
    setDraft(initialFilters);
    setFilters(initialFilters);
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setError('');
    setNotice('');
    try {
      const { data: response } = await adminAPI.enrichRegionalLocations({ limit: 10 });
      setNotice(
        `Location processing: ${response.processed_count} processed, ${response.successfully_geocoded} geocoded, `
        + `${response.successfully_identified} regionally identified, ${response.unsuccessful} failed, `
        + `${response.ambiguous} ambiguous, ${response.skipped} skipped. `
        + `${response.total_eligible} total eligible; ${response.remaining_eligible} remaining`
        + (response.has_another_batch ? '. Another batch is available.' : '. No eligible batch remains.')
      );
      setRetryToken((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not process regional locations.');
    } finally {
      setEnriching(false);
    }
  };

  const summary = data?.summary || { total: 0, resolved: 0, pending: 0, in_progress: 0, rejected: 0, resolution_percentage: 0 };
  const cards = [
    { label: 'Total complaints', value: summary.total, icon: Building2, tone: 'bg-[#27334f]/5 text-[#27334f]' },
    { label: 'Resolved', value: summary.resolved, icon: CheckCircle2, tone: 'bg-success/5 text-success' },
    { label: 'Pending', value: summary.pending, icon: Clock3, tone: 'bg-[#fce6da] text-[#ad4f1b]' },
    { label: 'In progress', value: summary.in_progress, icon: MapPinned, tone: 'bg-info/5 text-info' },
  ];

  const categoryMax = Math.max(1, ...(data?.categories || []).map((item) => Number(item.count)));
  const statusRows = data?.statuses || [];
  const mapComplaints = (data?.complaints || []).filter((complaint) => (
    complaint.latitude !== null
    && complaint.longitude !== null
    && Number.isFinite(Number(complaint.latitude))
    && Number.isFinite(Number(complaint.longitude))
  ));
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  const monthlyRows = data?.monthly || [];
  const currentMonthRow = monthlyRows.find((row) => row.month === currentMonth);
  const previousMonthRow = monthlyRows.find((row) => row.month === previousMonth);
  const currentSubmitted = Number(currentMonthRow?.submitted || 0);
  const previousSubmitted = Number(previousMonthRow?.submitted || 0);
  const currentResolved = Number(currentMonthRow?.resolved || 0);
  const previousResolved = Number(previousMonthRow?.resolved || 0);
  const submittedChange = previousSubmitted > 0
    ? (((currentSubmitted - previousSubmitted) / previousSubmitted) * 100).toFixed(1)
    : null;
  const resolvedChange = previousResolved > 0
    ? (((currentResolved - previousResolved) / previousResolved) * 100).toFixed(1)
    : null;
  const categoryRows = (data?.categories || []).map((row) => ({
    name: row.category === 'Unknown' ? 'Unknown / Other' : getComplaintCategoryLabel(row.category),
    rawName: row.category,
    count: Number(row.count),
  })).sort((a, b) => b.count - a.count);
  const categoryTotal = categoryRows.reduce((sum, row) => sum + row.count, 0);
  const categoryColours = ['#27334f', '#f29b38', '#2f6b4f', '#2d5f91', '#9c4f18', '#8b5cf6', '#64748b', '#c026d3'];
  let categoryAngle = 0;
  const categorySegments = categoryRows.map((row, index) => {
    const angle = categoryTotal > 0 ? (row.count / categoryTotal) * 360 : 0;
    const segment = { ...row, start: categoryAngle, angle, colour: categoryColours[index % categoryColours.length] };
    categoryAngle += angle;
    return segment;
  });
  const polarPoint = (angle, radius = 42) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return [50 + radius * Math.cos(radians), 50 + radius * Math.sin(radians)];
  };
  const donutArc = (segment) => {
    const start = polarPoint(segment.start, 80);
    const end = polarPoint(segment.start + segment.angle, 80);
    const largeArc = segment.angle > 180 ? 1 : 0;
  };

  return (
    <div className="min-h-screen bg-[#f2f4f7] pb-14">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#fce6da] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#ad4f1b]">
              <MapPinned className="h-4 w-4" aria-hidden="true" /> Administrator
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[#27334f] sm:text-4xl">Regional Insights</h1>
            <p className="mt-2 text-sm text-[#626b7d]">Complaint distribution, resolution patterns, and geographical trends.</p>
          </div>

          <button type="button" onClick={handleEnrich} disabled={enriching} className="inline-flex items-center gap-2 rounded-full border border-[#dfe2e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#626b7d] transition hover:border-[#27334f]/30 hover:text-[#27334f] disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`} aria-hidden="true" />
            {enriching ? 'Processing…' : 'Identify locations'}
          </button>
        </motion.header>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-error/20 bg-error/5 p-5 text-sm text-error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-6 rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">{notice}</div>
        )}

        <section aria-label="Regional filters" className="mb-8 rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-neutral-text">Region level
              <select value={draft.regionLevel} onChange={(event) => setDraft((current) => ({ ...current, regionLevel: event.target.value, region: '' }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal">
                <option value="">All identified regions</option>
                <option value="district">District</option>
                <option value="city">City / municipality</option>
                <option value="taluk">Taluk</option>
                <option value="village">Village</option>
                <option value="gram_panchayat">Gram Panchayat</option>
                <option value="ward">Ward</option>
                <option value="locality">Locality</option>
              </select>
            </label>
            {draft.regionLevel && (
              <label className="text-xs font-semibold text-neutral-text">Region
                <select value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal">
                  <option value="">All {draft.regionLevel.replace('_', ' ')} areas</option>
                  {(regionalOptions[draft.regionLevel] || []).map((option) => (
                    <option key={option.name} value={option.name}>{option.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs font-semibold text-neutral-text">From date
              <input type="date" value={draft.fromDate} onChange={(event) => setDraft((current) => ({ ...current, fromDate: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-neutral-text">To date
              <input type="date" value={draft.toDate} onChange={(event) => setDraft((current) => ({ ...current, toDate: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-neutral-text">Category
              <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal">
                <option value="">All categories</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{getComplaintCategoryLabel(category)}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-neutral-text">Status
              <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm font-normal">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Closed</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 rounded-full border border-neutral-light bg-white px-5 py-2.5 text-sm font-semibold text-neutral-text hover:border-error/30 hover:text-error">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset filters
            </button>
            <button type="button" onClick={applyFilters} className="rounded-full bg-[#27334f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f2a40]">Apply filters</button>
          </div>
        </section>

        <section aria-label="Regional summary" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-[#e4e6eb] bg-[#fffdfa] p-5 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#626b7d]">{card.label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="h-4 w-4" aria-hidden="true" /></span>
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-[#27334f]">{loading ? '—' : card.value}</p>
            </article>
          ))}
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <section className="overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
            <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink">Complaint distribution map</h2></div>
            {loading ? (
              <p className="px-6 py-12 text-center text-sm text-neutral-muted">Loading map…</p>
            ) : (
              <Suspense fallback={<p className="px-6 py-12 text-center text-sm text-neutral-muted">Loading map…</p>}>
                <RegionalMap complaints={mapComplaints} />
              </Suspense>
            )}
          </section>
          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink">Status overview</h2>
            <p className="mt-1 text-xs text-neutral-muted">{summary.resolution_percentage}% resolution percentage</p>
            <div className="mt-6 space-y-4">
              {statusRows.map((row) => (
                <div key={row.status}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-neutral-text">{statusLabel(row.status)}</span><span className="text-neutral-muted">{row.count}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-light">
                    <div className="h-full rounded-full bg-[#27334f]" style={{ width: `${summary.total ? (Number(row.count) / summary.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
              {statusRows.length === 0 && <p className="py-8 text-center text-sm text-neutral-muted">No status data.</p>}
            </div>
          </section>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink">Complaint categories</h2>
            <div className="mt-5 grid items-center gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
              {categorySegments.length > 0 ? (
                <>
                  <svg viewBox="0 0 100 100" role="img" aria-label="Complaint category donut chart" className="mx-auto h-44 w-44">
                    <circle cx="50" cy="50" r="80" fill="none" stroke="transparent" strokeWidth="18" />
                    {categorySegments.map((segment) => (
                      <path
                        key={segment.rawName}
                        d={donutArc(segment)}
                        fill="none"
                        stroke={segment.colour}
                        strokeWidth="18"
                        pathLength="360"
                      >
                        <title>{segment.name}: {segment.count} ({categoryTotal ? ((segment.count / categoryTotal) * 100).toFixed(1) : '0.0'}%)</title>
                      </path>
                    ))}
                    <circle cx="50" cy="50" r="48" fill="#fff8ee" />
                    <text x="50" y="47" textAnchor="middle" fill="#27334f" fontSize="8" fontWeight="700">{categoryTotal}</text>
                    <text x="50" y="57" textAnchor="middle" fill="#626b7d" fontSize="5">complaints</text>
                  </svg>
                  <div className="space-y-2">
                    {categorySegments.map((segment) => (
                      <div key={segment.rawName} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-neutral-text">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.colour }} />
                          <span className="truncate">{segment.name}</span>
                        </span>
                        <span className="shrink-0 text-neutral-muted">{segment.count} · {categoryTotal ? ((segment.count / categoryTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-sm text-neutral-muted sm:col-span-2">No category data.</p>
              )}
            </div>
          </section>
          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink">Monthly trend</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-light bg-white p-4">
                <p className="text-xs font-semibold text-neutral-muted">{previousMonth}</p>
                <p className="mt-2 text-2xl font-bold text-[#27334f]">{previousSubmitted}</p>
                <p className="mt-1 text-xs text-neutral-muted">{previousResolved} resolved</p>
              </div>
              <div className="rounded-2xl border border-neutral-light bg-white p-4">
                <p className="text-xs font-semibold text-neutral-muted">{currentMonth}</p>
                <p className="mt-2 text-2xl font-bold text-[#27334f]">{currentSubmitted}</p>
                <p className="mt-1 text-xs text-neutral-muted">{currentResolved} resolved</p>
              </div>
            </div>
            {(submittedChange !== null || resolvedChange !== null) && (
              <p className="mt-3 text-xs text-neutral-muted">
                {submittedChange !== null ? `Complaints ${submittedChange}% vs previous month` : 'Complaint percentage unavailable from a zero previous-month count'}
                {' · '}
                {resolvedChange !== null ? `Resolved ${resolvedChange}% vs previous month` : 'Resolved percentage unavailable from a zero previous-month count'}
              </p>
            )}
            <div className="mt-5 space-y-3">
              {(data?.monthly || []).map((row) => (
                <div key={row.month} className="flex items-center justify-between rounded-xl border border-neutral-light bg-white px-4 py-3 text-sm">
                  <span className="font-semibold text-neutral-text">{row.month}</span>
                  <span className="text-neutral-muted">{row.submitted} submitted · {row.resolved} resolved</span>
                </div>
              ))}
              {(data?.monthly || []).length === 0 && <p className="py-10 text-center text-sm text-neutral-muted">No monthly trend data.</p>}
            </div>
          </section>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink">Regional resolution performance</h2>
            <p className="mt-1 text-xs text-neutral-muted">Resolved complaints divided by total complaints.</p>
            <div className="mt-5 space-y-4">
              {[...(data?.regions || [])].sort((a, b) => {
                const aTotal = Number(a.total || 0);
                const bTotal = Number(b.total || 0);
                const aRate = aTotal ? Number(a.resolved || 0) / aTotal : 0;
                const bRate = bTotal ? Number(b.resolved || 0) / bTotal : 0;
                if (bRate !== aRate) return bRate - aRate;
                return bTotal - aTotal;
              }).filter((row) => Number(row.total || 0) > 0).map((row) => {
                const total = Number(row.total || 0);
                const resolved = Number(row.resolved || 0);
                const pending = Number(row.pending || 0);
                const inProgress = Number(row.in_progress || 0);
                const rate = total ? (resolved / total) * 100 : 0;
                return (
                  <div key={row.region}>
                    <div className="mb-1 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-neutral-text">{row.region}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-muted">{total} total · {resolved} resolved · {pending} pending · {inProgress} in progress</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[#27334f]">{rate.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-neutral-light">
                      <div className="h-full rounded-full bg-[#2f6b4f]" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })}
              {!(data?.regions || []).some((row) => Number(row.total || 0) > 0) && (
                <p className="py-10 text-center text-sm text-neutral-muted">No regional performance data.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink">Complaint status by region</h2>
            <p className="mt-1 text-xs text-neutral-muted">Resolved, pending, and assigned/in-progress complaints.</p>
            <div className="mt-5 space-y-4">
              {(data?.regions || []).filter((row) => Number(row.total || 0) > 0).sort((a, b) => Number(b.total) - Number(a.total)).map((row) => {
                const total = Number(row.total || 0);
                const resolved = Number(row.resolved || 0);
                const pending = Number(row.pending || 0);
                const inProgress = Number(row.in_progress || 0);
                return (
                  <div key={row.region}>
                    <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-semibold text-neutral-text">{row.region}</span><span className="shrink-0 text-neutral-muted">{total}</span></div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-neutral-light" title={`${row.region}: ${resolved} resolved, ${pending} pending, ${inProgress} assigned/in progress`}>
                      <span className="h-full bg-[#2f6b4f]" style={{ width: `${total ? (resolved / total) * 100 : 0}%` }} />
                      <span className="h-full bg-[#f29b38]" style={{ width: `${total ? (pending / total) * 100 : 0}%` }} />
                      <span className="h-full bg-[#2d5f91]" style={{ width: `${total ? (inProgress / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
              {!(data?.regions || []).some((row) => Number(row.total || 0) > 0) && (
                <p className="py-10 text-center text-sm text-neutral-muted">No regional status data.</p>
              )}
              <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-neutral-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2f6b4f]" />Resolved</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f29b38]" />Pending</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2d5f91]" />Assigned/in progress</span>
              </div>
            </div>
          </section>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          {(() => {
            const ranked = (data?.regions || []).filter((row) => Number(row.total || 0) > 0).map((row) => {
              const total = Number(row.total || 0);
              const resolved = Number(row.resolved || 0);
              const unresolved = total - resolved;
              return { ...row, total, resolved, unresolved, rate: total ? (resolved / total) * 100 : 0 };
            });
            const highest = [...ranked].sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
            const lowest = [...ranked].sort((a, b) => a.rate - b.rate || b.total - a.total)[0];
            const mostUnresolved = [...ranked].sort((a, b) => b.unresolved - a.unresolved || b.total - a.total)[0];
            return [
              { title: 'Highest resolution', row: highest, detail: (item) => `${item.rate.toFixed(1)}% resolved` },
              { title: 'Lowest resolution', row: lowest, detail: (item) => `${item.rate.toFixed(1)}% resolved` },
              { title: 'Most unresolved', row: mostUnresolved, detail: (item) => `${item.unresolved} unresolved complaints` },
            ].map((ranking) => (
              <article key={ranking.title} className="rounded-2xl border border-[#e4e6eb] bg-[#fffdfa] p-5 shadow-card">
                <p className="text-xs font-semibold text-[#626b7d]">{ranking.title}</p>
                {ranking.row ? (
                  <>
                    <p className="mt-3 truncate font-display text-lg font-bold text-[#27334f]">{ranking.row.region}</p>
                    <p className="mt-1 text-xs text-neutral-muted">{ranking.detail(ranking.row)}</p>
                    <p className="mt-2 text-xs text-neutral-muted">{ranking.row.total} total complaints</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-neutral-muted">No sufficient regional data.</p>
                )}
              </article>
            ));
          })()}
        </section>

        <section className="mb-8 overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink">Region comparison</h2></div>
          {(data?.regions || []).length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-neutral-muted">No identified regional data matches these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/50 text-xs uppercase tracking-wider text-neutral-muted">
                  <tr><th className="px-5 py-3 sm:px-7">Region</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Resolved</th><th className="px-4 py-3">Pending</th><th className="px-4 py-3">In progress</th><th className="px-4 py-3">Resolution %</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-light">
                  {data.regions.map((row) => {
                    const total = Number(row.total);
                    const resolved = Number(row.resolved || 0);
                    return (
                      <tr key={row.region}><td className="px-5 py-4 font-semibold text-neutral-text sm:px-7">{row.region}</td><td className="px-4 py-4">{total}</td><td className="px-4 py-4">{resolved}</td><td className="px-4 py-4">{Number(row.pending || 0)}</td><td className="px-4 py-4">{Number(row.in_progress || 0)}</td><td className="px-4 py-4">{total ? ((resolved / total) * 100).toFixed(1) : '0.0'}%</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink">Regional complaints</h2></div>
          {(data?.complaints || []).length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-neutral-muted">No complaints match the selected region and filters.</p>
          ) : (
            <ul className="divide-y divide-neutral-light">
              {data.complaints.map((complaint) => (
                <li key={complaint.id}>
                  <Link to={`/complaints/${complaint.id}`} className="group flex flex-col justify-between gap-3 px-5 py-5 transition hover:bg-white/50 sm:flex-row sm:items-center sm:px-7">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#fce6da] px-3 py-1 text-[11px] font-bold text-[#ad4f1b]">{statusLabel(complaint.status)}</span><span className="font-mono text-[11px] text-neutral-muted">{complaint.reference_number}</span></div>
                      <h3 className="font-semibold text-neutral-text">{getComplaintCategoryLabel(complaint.category)}</h3>
                      <p className="mt-1 truncate text-sm text-neutral-muted">{complaint.description || complaint.location_address}</p>
                      <p className="mt-2 text-xs text-neutral-muted">{complaint.region_name || 'Unidentified region'} · {formatDate(complaint.created_at)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-muted group-hover:text-brand-ink">Open complaint <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
