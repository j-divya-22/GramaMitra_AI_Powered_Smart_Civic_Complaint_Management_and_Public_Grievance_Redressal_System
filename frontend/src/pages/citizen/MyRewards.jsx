import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock3, Gift, IndianRupee, RefreshCw, WalletCards } from 'lucide-react';
import { rewardAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import BilingualText from '../../components/i18n/BilingualText';

const formatInr = (value, language) => new Intl.NumberFormat(language === 'en' ? 'en-IN' : `${language}-IN`, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value, language) => value
  ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const withdrawalStatusLabel = (status) => ({
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  PAYMENT_INITIATED: 'Payment initiated',
  PAYMENT_FAILED: 'Payment failed',
  PAID: 'Paid',
  REJECTED: 'Rejected',
}[status] || status || 'Unknown');

export default function MyRewards() {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [earlyWithdrawal, setEarlyWithdrawal] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    rewardAPI.getMine()
      .then(({ data }) => {
        if (active) setRewards(data.rewards);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || 'Unable to load your reward information.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retryToken]);

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid withdrawal amount.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const { data } = await rewardAPI.requestWithdrawal({
        requested_amount: amount,
        early_withdrawal: earlyWithdrawal,
      });
      setNotice(data.message);
      setRequestedAmount('');
      setEarlyWithdrawal(false);
      setRetryToken((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to submit the withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cards = [
    { label: 'Resolved complaints', value: rewards?.successfully_resolved_complaints ?? 0, icon: CheckCircle2, tone: 'bg-success/5 text-success' },
    { label: 'Reward points', value: rewards?.total_points ?? 0, icon: Gift, tone: 'bg-saffron-light/50 text-warning' },
    { label: 'Amount earned', value: formatInr(rewards?.total_amount_earned, language), icon: IndianRupee, tone: 'bg-brand-ink/5 text-brand-ink' },
    { label: 'Available balance', value: formatInr(rewards?.available_unpaid_balance, language), icon: WalletCards, tone: 'bg-info/5 text-info' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f8f3] pb-14">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-saffron-light/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-muted">
            <Gift className="h-4 w-4" aria-hidden="true" /> <BilingualText english="Citizen rewards" />
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold text-brand-ink sm:text-4xl"><BilingualText english="My Rewards" /></h1>
          <p className="mt-2 text-sm text-neutral-muted"><BilingualText english="Track resolved-complaint rewards and withdrawal requests." /></p>
        </motion.header>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-error/20 bg-error/5 p-5 text-sm text-error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p><BilingualText english={error} /></p>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-6 rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success"><BilingualText english={notice} /></div>
        )}

        <section aria-label="Reward summary" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-neutral-light bg-surface-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-muted"><BilingualText english={card.label} /></p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="h-4 w-4" aria-hidden="true" /></span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-brand-ink">{loading ? '—' : card.value}</p>
            </article>
          ))}
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-light bg-surface-card p-5 shadow-card">
            <p className="text-xs font-semibold text-neutral-muted"><BilingualText english="Submission rewards" /></p>
            <p className="mt-2 font-display text-2xl font-bold text-brand-ink">{rewards?.submission_reward_points ?? 0} <BilingualText english="points" /> · {formatInr(rewards?.submission_reward_amount, language)}</p>
          </div>
          <div className="rounded-2xl border border-neutral-light bg-surface-card p-5 shadow-card">
            <p className="text-xs font-semibold text-neutral-muted"><BilingualText english="Resolution bonuses" /></p>
            <p className="mt-2 font-display text-2xl font-bold text-brand-ink">{rewards?.resolution_reward_points ?? 0} <BilingualText english="points" /> · {formatInr(rewards?.resolution_reward_amount, language)}</p>
          </div>
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink"><BilingualText english="Withdrawal eligibility" /></h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-success/5 p-4"><p className="text-xs text-neutral-muted"><BilingualText english="Eligible now" /></p><p className="mt-2 text-lg font-bold text-success">{formatInr(rewards?.total_amount_earned, language)}</p></div>
              <div className="rounded-2xl bg-warning/5 p-4"><p className="text-xs text-neutral-muted"><BilingualText english="Waiting 6 months" /></p><p className="mt-2 text-lg font-bold text-warning">{formatInr(rewards?.total_amount_earned, language)}</p></div>
              <div className="rounded-2xl bg-info/5 p-4"><p className="text-xs text-neutral-muted"><BilingualText english="Already paid" /></p><p className="mt-2 text-lg font-bold text-info">{formatInr(rewards?.total_amount_paid, language)}</p></div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <h2 className="font-display text-xl font-bold text-brand-ink"><BilingualText english="Request withdrawal" /></h2>
            <form onSubmit={submitWithdrawal} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-neutral-text">
                <BilingualText english="Amount in rupees" />
                <input type="number" min="1" step="0.01" value={requestedAmount} onChange={(event) => setRequestedAmount(event.target.value)} placeholder={t('Enter amount', { defaultValue: 'Enter amount', keySeparator: false })} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-3 text-sm outline-none focus:border-brand-ink" />
              </label>
              <label className="flex items-start gap-3 rounded-xl bg-saffron-light/30 p-3 text-xs text-neutral-text">
                <input type="checkbox" checked={earlyWithdrawal} onChange={(event) => setEarlyWithdrawal(event.target.checked)} className="mt-0.5 accent-brand-ink" />
                <BilingualText english="Request early withdrawal. This is subject to administrator review." />
              </label>
              <button type="submit" disabled={submitting || loading} className="w-full rounded-full bg-brand-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-ink-dark disabled:opacity-50">
                <BilingualText english={submitting ? 'Submitting…' : 'Request withdrawal'} />
              </button>
            </form>
          </section>
        </div>

        <section className="mb-8 overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink"><BilingualText english="Reward history" /></h2></div>
          {!loading && (rewards?.transactions || []).length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-neutral-muted"><BilingualText english="No reward transactions yet." /></p>
          ) : (
            <ul className="divide-y divide-neutral-light">
              {(rewards?.transactions || []).map((transaction) => (
                <li key={transaction.id} className="px-5 py-4 sm:px-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-neutral-text">{transaction.description}</p><p className="mt-1 text-xs text-neutral-muted"><BilingualText english="Earned" /> {formatDate(transaction.earned_at, language)} · <BilingualText english="Eligible" /> {formatDate(transaction.eligibility_date, language)}</p></div>
                    <div className="text-right"><p className="text-sm font-bold text-brand-ink">{transaction.points} <BilingualText english={transaction.points === 1 ? 'point' : 'points'} /> · {formatInr(transaction.amount, language)}</p>{transaction.complaint_id && <p className="mt-1 text-xs text-neutral-muted"><BilingualText english="Complaint #{{id}}" values={{ id: transaction.complaint_id }} /></p>}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink"><BilingualText english="Withdrawal history" /></h2></div>
          {!loading && (rewards?.withdrawals || []).length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-neutral-muted"><BilingualText english="No withdrawal requests yet." /></p>
          ) : (
            <ul className="divide-y divide-neutral-light">
              {(rewards?.withdrawals || []).map((withdrawal) => (
                <li key={withdrawal.id} className="px-5 py-4 sm:px-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-bold text-neutral-text">{formatInr(withdrawal.requested_amount, language)}</p><p className="mt-1 text-xs text-neutral-muted"><BilingualText english="Requested" /> {formatDate(withdrawal.requested_at, language)}{withdrawal.is_early_withdrawal ? <> · <BilingualText english="Early withdrawal" /></> : ''}</p></div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      withdrawal.request_status === 'PAID'
                        ? 'bg-success/10 text-success'
                        : withdrawal.request_status === 'REJECTED'
                          ? 'bg-error/10 text-error'
                          : withdrawal.request_status === 'PAYMENT_FAILED'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-brand-ink/5 text-brand-ink'
                    }`}><BilingualText english={withdrawalStatusLabel(withdrawal.request_status)} /></span>
                  </div>
                  {withdrawal.request_status === 'REJECTED' && withdrawal.rejection_reason && (
                    <p className="mt-2 text-xs text-error">Withdrawal rejected: {withdrawal.rejection_reason}</p>
                  )}
                  {withdrawal.request_status === 'PAYMENT_FAILED' && (
                    <p className="mt-2 text-xs text-warning">Payment failed. This remains unpaid and may be retried after approval.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
