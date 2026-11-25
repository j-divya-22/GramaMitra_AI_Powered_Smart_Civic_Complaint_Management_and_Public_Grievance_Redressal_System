import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, Image, Loader2, Trash2,
  MapPin, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isLocalDemoMode } from '../../config/authMode';
import { complaintAPI } from '../../services/api';
import {
  getCitizenComplaintCategoryLabel,
  getComplaintCategoryLabel,
} from '../../utils/complaintCategory';
import { formatCnnConfidence } from '../../utils/cnnConfidence';
import {
  getLocalComplaint,
} from '../../services/localComplaints';
import AIChatPanel from '../../components/ai/AIChatPanel';
import { prepareEvidenceImage } from '../../services/evidence';
import { useLanguage } from '../../context/LanguageContext';
import BilingualText from '../../components/i18n/BilingualText';

const PROGRESS_STAGES = [
  { value: 'Complaint Received', detail: 'Your report has reached Gramamitra.' },
  { value: 'Investigation', detail: 'The response team is investigating the report.' },
  { value: 'Work in Progress', detail: 'The team is working on the reported issue.' },
  { value: 'Verification', detail: 'The completed work is being verified.' },
  { value: 'Resolved', detail: 'The reported issue has been addressed.' },
];

const statusLabel = (status) => ({
  pending: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Closed',
}[status] || status || 'Unknown');

const formatDate = (value, language) => {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};

function ScopedText({ english, bilingual, className }) {
  return bilingual
    ? <BilingualText english={english} className={className} />
    : english;
}

const imageUrl = (file) => {
  const url = file.url || file.data_url;
  if (!url || url.startsWith('data:') || url.startsWith('https://') || url.startsWith('http://')) return url;
  return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}${url}`;
};

export default function ComplaintDetail({ staffView = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAdminView = staffView || user?.role === 'admin';
  const categoryLabel = isAdminView
    ? getComplaintCategoryLabel
    : getCitizenComplaintCategoryLabel;
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailableEvidence, setUnavailableEvidence] = useState(() => new Set());
  const [progressStage, setProgressStage] = useState(PROGRESS_STAGES[0].value);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [progressRemarks, setProgressRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingComplaint, setDeletingComplaint] = useState(false);
  const [imageMutationId, setImageMutationId] = useState(null);
  const [notice, setNotice] = useState('');

  const loadComplaint = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let loadedComplaint;
      if (isLocalDemoMode) {
        const found = getLocalComplaint(id, staffView ? undefined : user?.id);
        if (!found) throw new Error('This report could not be found in this browser.');
        loadedComplaint = found;
      } else {
        const { data } = await complaintAPI.getById(id);
        loadedComplaint = data.complaint;
      }
      setComplaint(loadedComplaint);
      const updates = loadedComplaint.progress_updates || [];
      const latestUpdate = updates[updates.length - 1];
      setProgressStage(latestUpdate?.stage || PROGRESS_STAGES[0].value);
      setProgressPercentage(latestUpdate ? Number(latestUpdate.progress_percentage) : 0);
    } catch (loadError) {
      setError(loadError.response?.data?.error || loadError.message || 'Unable to load this report.');
    } finally {
      setLoading(false);
    }
  }, [id, staffView, user?.id]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  const normalized = useMemo(() => {
    if (!complaint) return null;
    const englishDescription = complaint.englishDescription || complaint.description || complaint.english_text || '';
    const originalDescription = complaint.original_complaint
      ?? complaint.original_text
      ?? (isLocalDemoMode ? complaint.description : '');
    const statusTimeline = complaint.timeline || [{
      id: 'current-status',
      status: complaint.status,
      actorName: 'Gramamitra',
      actorRole: 'system',
      message: `Current status: ${statusLabel(complaint.status)}.`,
      createdAt: complaint.updated_at || complaint.created_at,
    }];
    const progressUpdates = complaint.progress_updates || [];
    const timeline = [
      ...statusTimeline.map((item) => ({ ...item, timelineType: 'status' })),
      ...progressUpdates.map((item) => ({
        ...item,
        id: `progress-${item.id}`,
        status: item.stage,
        message: item.remarks,
        actorName: item.admin_name,
        createdAt: item.created_at,
        timelineType: 'progress',
      })),
    ].sort((a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at));
    return {
      id: complaint.id || id,
      reference: complaint.referenceNumber || complaint.reference_number,
      category: complaint.category,
      description: englishDescription || originalDescription,
      originalDescription,
      englishDescription,
      location: complaint.locationAddress || complaint.location_address,
      latitude: complaint.latitude,
      longitude: complaint.longitude,
      status: complaint.status,
      createdAt: complaint.createdAt || complaint.created_at,
      evidence: complaint.evidenceFiles || complaint.evidence_files || [],
      timeline,
      progressUpdates,
      citizenName: complaint.citizenName || complaint.citizen_name || user?.name || 'Citizen',
      canCitizenModify: complaint.can_citizen_modify === true,
      ownerRewardSummary: complaint.owner_reward_summary || null,
    };
  }, [complaint, user?.name]);
  const canManageComplaint = !isAdminView
    && !staffView
    && !isLocalDemoMode
    && user?.role === 'citizen'
    && normalized?.canCitizenModify;
  const latestProgressUpdate = normalized?.progressUpdates[normalized.progressUpdates.length - 1];
  const currentProgressStage = latestProgressUpdate?.stage || PROGRESS_STAGES[0].value;
  const currentProgressPercentage = latestProgressUpdate
    ? Number(latestProgressUpdate.progress_percentage)
    : 0;
  const activeTrackingStep = Math.max(0, PROGRESS_STAGES.findIndex((step) => step.value === currentProgressStage));

  const postProgressUpdate = async (event) => {
    event.preventDefault();
    if (user?.role !== 'admin') {
      setError('Only authenticated administrators can publish progress updates.');
      return;
    }
    const parsedPercentage = Number(progressPercentage);
    if (!Number.isInteger(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 100) {
      setError('Progress percentage must be an integer from 0 to 100.');
      return;
    }
    if (progressStage === 'Resolved' && parsedPercentage !== 100) {
      setError('Resolved progress requires 100% completion.');
      return;
    }
    if (!progressRemarks.trim()) {
      setError('Add remarks about completed and pending work before publishing the update.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await complaintAPI.createProgressUpdate(id, {
        stage: progressStage,
        progress_percentage: parsedPercentage,
        remarks: progressRemarks,
      });
      setProgressRemarks('');
      await loadComplaint();
    } catch (saveError) {
      setError(saveError.response?.data?.error || saveError.message || 'Unable to publish this progress update.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCitizenComplaint = async () => {
    if (!canManageComplaint) return;
    const confirmed = window.confirm(
      'Delete this complaint and all of its evidence images? This cannot be undone.'
    );
    if (!confirmed) return;

    setDeletingComplaint(true);
    setError('');
    setNotice('');
    try {
      const { data } = await complaintAPI.delete(id);
      if (data.cleanup_warning) {
        toast.error('Complaint deleted, but some image files could not be cleaned up. Contact support.');
      } else if (data.reward_transactions_detached > 0) {
        toast.success('Complaint deleted. Its reward history was retained in your points record.');
      } else {
        toast.success('Complaint deleted.');
      }
      navigate('/dashboard', { replace: true });
    } catch (deleteError) {
      setError(deleteError.response?.data?.error || deleteError.message || 'Unable to delete this complaint.');
    } finally {
      setDeletingComplaint(false);
    }
  };

  const replaceCitizenImage = async (imageId, file) => {
    if (!canManageComplaint || !file) return;
    setImageMutationId(String(imageId));
    setError('');
    setNotice('');
    try {
      const preparedImage = await prepareEvidenceImage(file);
      const replacementFile = new File([preparedImage.blob], preparedImage.name, {
        type: preparedImage.type,
      });
      const { data } = await complaintAPI.replaceImage(id, imageId, replacementFile);
      await loadComplaint();
      setNotice(data.cleanup_warning
        ? 'The replacement was saved, but the previous image file could not be cleaned up.'
        : 'Image replaced and CNN classification updated.');
    } catch (replaceError) {
      setError(replaceError.response?.data?.error || replaceError.message || 'Unable to replace this image.');
    } finally {
      setImageMutationId(null);
    }
  };

  const removeCitizenImage = async (imageId) => {
    if (!canManageComplaint || normalized.evidence.length <= 1) return;
    if (!window.confirm('Remove this photo from the complaint?')) return;

    setImageMutationId(String(imageId));
    setError('');
    setNotice('');
    try {
      const { data } = await complaintAPI.deleteImage(id, imageId);
      await loadComplaint();
      if (data.cleanup_warning) {
        setNotice('The image was removed, but its file could not be cleaned up.');
      }
    } catch (removeError) {
      setError(removeError.response?.data?.error || removeError.message || 'Unable to remove this image.');
    } finally {
      setImageMutationId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-brand-ink">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-sm font-semibold"><ScopedText english="Loading report…" bilingual={user?.role !== 'admin'} /></span>
      </div>
    );
  }

  if (error && !normalized) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div role="alert" className="rounded-3xl border border-error/20 bg-surface-card p-8 text-center">
          <p className="font-semibold text-error">{error}</p>
          <button type="button" onClick={() => navigate(staffView ? '/staff-preview' : '/dashboard')} className="btn-secondary mt-6 !px-5 !py-2 !text-sm">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!normalized) return null;

  return (
    <div className={`min-h-screen pb-14 ${isAdminView ? 'bg-[#f2f4f7]' : 'bg-surface-canvas'}`}>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(staffView ? '/staff-preview' : '/dashboard')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
              isAdminView
                ? 'text-[#626b7d] hover:bg-[#27334f]/5 hover:text-[#27334f]'
                : 'text-neutral-muted hover:bg-neutral-light hover:text-brand-ink'
            }`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {staffView ? 'Staff workspace' : <ScopedText english="My reports" bilingual={!isAdminView} />}
          </button>
          <span className={`rounded-full px-4 py-2 font-mono text-xs font-bold ${
            isAdminView ? 'bg-[#27334f]/5 text-[#27334f]' : 'bg-brand-ink/5 text-brand-ink'
          }`}>
            {normalized.reference}
          </span>
        </div>

        {staffView && (
          <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-saffron-muted/30 bg-saffron-light/25 p-4 text-sm text-neutral-text">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
            <p><strong>Staff preview only.</strong> Updates and messages are stored in this browser and are not visible to a real authority.</p>
          </div>
        )}

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 flex flex-col justify-between gap-5 rounded-3xl p-6 text-surface-canvas shadow-premium sm:flex-row sm:items-end sm:p-8 ${
            isAdminView ? 'bg-[#27334f]' : 'bg-brand-ink'
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron-muted"><ScopedText english="Complaint tracker" bilingual={!isAdminView} /></p>
            <h1 className="mt-2 font-display text-3xl font-bold text-surface-canvas">
              <ScopedText english={categoryLabel(normalized.category)} bilingual={!isAdminView} />
            </h1>
            {isAdminView && normalized.evidence.length === 0 && (
              <p className="mt-2 text-sm text-surface-canvas/75">
                CNN prediction: Not available · CNN Confidence: Not available
              </p>
            )}
            {normalized.englishDescription && (
              <div className="mt-3 max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-surface-canvas/60"><ScopedText english="English description" bilingual={!isAdminView} /></p>
                <p className="mt-1 text-sm leading-relaxed text-surface-canvas/75">{normalized.englishDescription}</p>
              </div>
            )}
            {normalized.originalDescription && (
              <div className="mt-3 max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-surface-canvas/60"><ScopedText english="Original complaint text" bilingual={!isAdminView} /></p>
                <p className="mt-1 text-sm leading-relaxed text-surface-canvas/75">{normalized.originalDescription}</p>
              </div>
            )}
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-saffron" />
            <ScopedText english={statusLabel(normalized.status)} bilingual={!isAdminView} />
          </span>
        </motion.header>

        {error && <p role="alert" className="mb-6 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</p>}
        {notice && <p role="status" className="mb-6 rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-success">{notice}</p>}
        {canManageComplaint && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-light bg-surface-card px-4 py-3">
            <p className="text-sm text-neutral-muted"><BilingualText english="You can update or delete this complaint until admin processing begins." /></p>
            <button
              type="button"
              onClick={deleteCitizenComplaint}
              disabled={deletingComplaint || imageMutationId !== null}
              className="inline-flex items-center gap-2 rounded-full border border-error/30 px-4 py-2 text-sm font-bold text-error transition hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingComplaint ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              <BilingualText english="Delete complaint" />
            </button>
          </div>
        )}

        <section
          aria-label={isAdminView ? 'Report tracking progress' : 'Track your report'}
          className="mb-6 rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-saffron-muted"><ScopedText english="Live progress" bilingual={!isAdminView} /></p>
              <h2 className="mt-1 font-display text-xl font-bold text-brand-ink"><ScopedText english="Track your report" bilingual={!isAdminView} /></h2>
            </div>
            <p className="text-sm font-semibold text-neutral-text"><ScopedText english={currentProgressStage} bilingual={!isAdminView} /> · {currentProgressPercentage}%</p>
          </div>
          <div
            role="progressbar"
            aria-label={isAdminView ? 'Report resolution progress' : 'Track your report'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={currentProgressPercentage}
            className="mb-6 h-2 overflow-hidden rounded-full bg-neutral-light"
          >
            <motion.div
              className="h-full rounded-full bg-success"
              initial={{ width: 0 }}
              animate={{ width: `${currentProgressPercentage}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-5">
            {PROGRESS_STAGES.map((step, index) => {
              const isComplete = index < activeTrackingStep;
              const isCurrent = index === activeTrackingStep;
              return (
                <li key={step.value} aria-current={isCurrent ? 'step' : undefined} className="relative min-w-0">
                  {index < PROGRESS_STAGES.length - 1 && (
                    <span
                      className={`absolute left-9 right-[-0.75rem] top-4 hidden h-0.5 sm:block ${isComplete ? 'bg-success' : 'bg-neutral-light'}`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2 sm:flex-col sm:items-start">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isComplete ? 'bg-success text-white' : isCurrent ? 'bg-brand-ink text-white ring-4 ring-brand-ink/10' : 'bg-neutral-light text-neutral-muted'
                    }`}>
                      {isComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={`text-xs font-bold leading-tight ${isComplete || isCurrent ? 'text-brand-ink' : 'text-neutral-muted'}`}><ScopedText english={step.value} bilingual={!isAdminView} /></span>
                  </div>
                  <p className="ml-10 mt-1 hidden text-[11px] leading-relaxed text-neutral-muted sm:block sm:ml-0"><ScopedText english={step.detail} bilingual={!isAdminView} /></p>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-brand-ink"><ScopedText english="Progress & status history" bilingual={!isAdminView} /></h2>
                  <p className="mt-1 text-xs text-neutral-muted"><ScopedText english="Chronological progress updates and complaint status changes." bilingual={!isAdminView} /></p>
                  {normalized.progressUpdates.length === 0 && (
                    <p className="mt-2 text-xs text-neutral-muted"><ScopedText english="No manual progress updates have been published yet." bilingual={!isAdminView} /></p>
                  )}
                </div>
                <Clock3 className="h-5 w-5 text-saffron-muted" aria-hidden="true" />
              </div>
              {normalized.timeline.length === 0 ? (
                <p className="rounded-2xl bg-white/70 px-4 py-6 text-center text-sm text-neutral-muted"><ScopedText english="No progress updates have been published yet." bilingual={!isAdminView} /></p>
              ) : (
                <ol className="relative space-y-0">
                  {normalized.timeline.map((item, index) => (
                  <li key={item.id || `${item.status}-${index}`} className="relative flex gap-4 pb-7 last:pb-0">
                    {index < normalized.timeline.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-24px)] w-px bg-neutral-light" aria-hidden="true" />}
                    <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      index === normalized.timeline.length - 1 ? 'bg-brand-ink text-white' : 'bg-success/10 text-success'
                    }`}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-neutral-text">
                          <ScopedText english={item.timelineType === 'progress' ? item.status : statusLabel(item.status)} bilingual={!isAdminView} />
                        </p>
                        <time className="text-xs text-neutral-muted">{formatDate(item.createdAt || item.created_at, language)}</time>
                      </div>
                      {item.timelineType === 'progress' && (
                        <p className="mt-1 text-xs font-semibold text-success">{Number(item.progress_percentage)}% complete</p>
                      )}
                      <p className="mt-1 text-sm leading-relaxed text-neutral-muted">{item.message}</p>
                      <p className="mt-2 text-xs font-semibold text-brand-ink">{item.actorName || item.actor_name || 'Gramamitra'}</p>
                    </div>
                  </li>
                  ))}
                </ol>
              )}
            </section>

          </div>

          <aside className="space-y-6">
            {!isLocalDemoMode && (
              <AIChatPanel
                complaintId={normalized.id}
                title={isAdminView ? 'Ask about this complaint' : 'Ask about your complaint'}
                compact
                bilingual={!isAdminView}
              />
            )}
            <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-6">
              <h2 className="font-display text-lg font-bold text-brand-ink"><ScopedText english="Report details" bilingual={!isAdminView} /></h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-muted"><ScopedText english="Submitted by" bilingual={!isAdminView} /></dt>
                  <dd className="mt-1 font-semibold text-neutral-text">{normalized.citizenName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-muted"><ScopedText english="Submitted" bilingual={!isAdminView} /></dt>
                  <dd className="mt-1 font-semibold text-neutral-text">{formatDate(normalized.createdAt, language)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-muted"><ScopedText english="Location" bilingual={!isAdminView} /></dt>
                  <dd className="mt-1 flex items-start gap-2 font-medium text-neutral-text">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                    <span>{normalized.location || <ScopedText english="No address provided" bilingual={!isAdminView} />}</span>
                  </dd>
                  {normalized.latitude !== null && normalized.latitude !== undefined && normalized.longitude !== null && (
                    <dd className="ml-6 mt-1 text-xs text-neutral-muted">{Number(normalized.latitude).toFixed(5)}, {Number(normalized.longitude).toFixed(5)}</dd>
                  )}
                </div>
              </dl>
            </section>

            {isAdminView && normalized.ownerRewardSummary && (
              <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-6">
                <h2 className="font-display text-lg font-bold text-brand-ink">Citizen reward summary</h2>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-brand-ink/5 p-3">
                    <dt className="text-[11px] text-neutral-muted">Reward points</dt>
                    <dd className="mt-1 font-bold text-brand-ink">{normalized.ownerRewardSummary.total_points}</dd>
                  </div>
                  <div className="rounded-xl bg-success/5 p-3">
                    <dt className="text-[11px] text-neutral-muted">Available balance</dt>
                    <dd className="mt-1 font-bold text-success">₹{Number(normalized.ownerRewardSummary.available_unpaid_balance || 0).toFixed(2)}</dd>
                  </div>
                  <div className="rounded-xl bg-saffron-light/30 p-3">
                    <dt className="text-[11px] text-neutral-muted">Earned</dt>
                    <dd className="mt-1 font-bold text-neutral-text">₹{Number(normalized.ownerRewardSummary.total_amount_earned || 0).toFixed(2)}</dd>
                  </div>
                  <div className="rounded-xl bg-info/5 p-3">
                    <dt className="text-[11px] text-neutral-muted">Resolved complaints</dt>
                    <dd className="mt-1 font-bold text-neutral-text">{normalized.ownerRewardSummary.successfully_resolved_complaints}</dd>
                  </div>
                </dl>
              </section>
            )}

            {normalized.evidence.length > 0 && (
              <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-brand-ink">
                  <Image className="h-4 w-4" aria-hidden="true" /> <ScopedText english="Photo evidence" bilingual={!isAdminView} />
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {normalized.evidence.map((file, index) => {
                    const src = imageUrl(file);
                    const imageKey = file.path || src || file.filename || String(index);
                    const imageUnavailable = isAdminView && (
                      !src || unavailableEvidence.has(imageKey)
                    );
                    return (
                      <div key={file.filename || file.name || index} className="min-w-0">
                        {imageUnavailable ? (
                          <div role="img" aria-label="Image unavailable" className="flex aspect-square items-center justify-center rounded-xl border border-neutral-light bg-neutral-light/50 px-3 text-center text-sm text-neutral-muted">
                            <ScopedText english="Image unavailable" bilingual={!isAdminView} />
                          </div>
                        ) : src && (
                          <a href={src} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-neutral-light">
                            <img
                              src={src}
                              alt={file.originalname || file.name || `Evidence ${index + 1}`}
                              onError={() => setUnavailableEvidence((current) => new Set(current).add(imageKey))}
                              className="max-h-80 w-full bg-white object-contain transition duration-300 group-hover:scale-[1.02]"
                            />
                            <span className="absolute bottom-2 right-2 rounded-full bg-brand-ink-dark/80 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          </a>
                        )}
                        {isAdminView && (
                          <div className="mt-2 rounded-lg bg-brand-ink/5 px-2.5 py-2 text-center text-xs font-semibold text-brand-ink">
                            <p>CNN prediction: {file.cnn_category ? categoryLabel(file.cnn_category) : 'Not available'}</p>
                            <p className="mt-1">{formatCnnConfidence(file.cnn_confidence)}</p>
                          </div>
                        )}
                        {canManageComplaint && file.id !== undefined && (
                          <div className="mt-2 flex flex-wrap justify-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand-ink/20 px-3 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-brand-ink/5">
                              {imageMutationId === String(file.id) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Image className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              Replace image
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                disabled={imageMutationId !== null || deletingComplaint}
                                onChange={(event) => {
                                  const replacement = event.target.files?.[0];
                                  event.target.value = '';
                                  if (replacement) replaceCitizenImage(file.id, replacement);
                                }}
                              />
                            </label>
                            {normalized.evidence.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCitizenImage(file.id)}
                                disabled={imageMutationId !== null || deletingComplaint}
                                className="inline-flex items-center gap-1.5 rounded-full border border-error/25 px-3 py-1.5 text-xs font-semibold text-error transition hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {user?.role === 'admin' && !staffView && (
              <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-6">
                <h2 className="font-display text-lg font-bold text-brand-ink">Publish progress update</h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-muted">Each update is saved permanently and added to the citizen-facing timeline.</p>
                <form onSubmit={postProgressUpdate} className="mt-4 space-y-3">
                  <label htmlFor="progress-stage" className="block text-xs font-bold text-neutral-text">Current work stage</label>
                  <select
                    id="progress-stage"
                    value={progressStage}
                    onChange={(event) => setProgressStage(event.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm text-neutral-text outline-none focus:border-brand-ink"
                  >
                    {PROGRESS_STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.value}</option>)}
                  </select>
                  <label htmlFor="progress-percentage" className="block text-xs font-bold text-neutral-text">Completion percentage</label>
                  <input
                    id="progress-percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    value={progressPercentage}
                    onChange={(event) => setProgressPercentage(event.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm text-neutral-text outline-none focus:border-brand-ink focus:ring-4 focus:ring-brand-ink/10"
                  />
                  <label htmlFor="progress-remarks" className="block text-xs font-bold text-neutral-text">Progress remarks</label>
                  <textarea
                    id="progress-remarks"
                    value={progressRemarks}
                    onChange={(event) => setProgressRemarks(event.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="Explain what is completed, what remains, and any reason for delay…"
                    disabled={saving}
                    className="w-full resize-y rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm text-neutral-text outline-none focus:border-brand-ink focus:ring-4 focus:ring-brand-ink/10"
                  />
                  <button type="submit" disabled={saving || !progressRemarks.trim()} className="w-full rounded-full bg-brand-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-ink-dark disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save progress update'}
                  </button>
                </form>
              </section>
            )}

            {!staffView && (
              <section className="rounded-3xl border border-saffron-muted/25 bg-saffron-light/20 p-5">
                <p className="text-sm font-bold text-brand-ink"><ScopedText english="Need to add context?" bilingual={!isAdminView} /></p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-muted"><ScopedText english="Send a question in the conversation above. Staff replies will appear in the same thread." bilingual={!isAdminView} /></p>
              </section>
            )}

            {normalized.status === 'resolved' && (
              <div className="flex items-start gap-3 rounded-2xl bg-success/5 p-4 text-sm text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p><ScopedText english="This report has been marked resolved." bilingual={!isAdminView} /></p>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-8">
          <Link to={staffView ? '/staff-preview' : '/dashboard'} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {staffView ? 'Back to staff workspace' : <ScopedText english="Back to my reports" bilingual={!isAdminView} />}
          </Link>
        </div>
      </main>
    </div>
  );
}
