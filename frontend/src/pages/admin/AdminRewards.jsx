import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, IndianRupee, RefreshCw, XCircle } from 'lucide-react';
import { rewardAPI } from '../../services/api';

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export default function AdminRewards() {
  const [citizens, setCitizens] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedCitizen, setSelectedCitizen] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([rewardAPI.getAdminCitizens(), rewardAPI.getAdminWithdrawals()])
      .then(([citizenResponse, withdrawalResponse]) => {
        if (!active) return;
        setCitizens(citizenResponse.data.citizens || []);
        setWithdrawals(withdrawalResponse.data.withdrawals || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || 'Unable to load reward information.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retryToken]);

  const review = async (withdrawalId, action, rejectionReason = '') => {
    setError('');
    setNotice('');
    try {
      await rewardAPI.reviewWithdrawal(withdrawalId, {
        action,
        rejection_reason: rejectionReason,
      });
      setNotice(action === 'approve' ? 'Withdrawal approved.' : 'Withdrawal rejected.');
      setRetryToken((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to review withdrawal.');
    }
  };

  const initiatePayment = async (withdrawal) => {
    setError('');
    setNotice('');
    try {
      await rewardAPI.initiatePayment(withdrawal.id, {
        payment_method: paymentMethod,
        payment_reference: paymentReference,
      });
      setNotice('Payment initiation recorded. No money is marked paid until confirmed.');
      setRetryToken((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to initiate payment record.');
    }
  };

  const confirmPayment = async (withdrawal, outcome) => {
    setError('');
    setNotice('');
    try {
      await rewardAPI.confirmPayment(withdrawal.id, {
        outcome,
        payment_reference: paymentReference,
        failure_reason: failureReason,
      });
      setNotice(outcome === 'success'
        ? 'Successful payment confirmed and balance updated.'
        : 'Payment failure recorded; the balance remains unpaid.');
      setRetryToken((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to confirm payment.');
    }
  };

  const openCitizenDetails = async (citizenId) => {
    setError('');
    try {
      const { data } = await rewardAPI.getAdminCitizen(citizenId);
      setSelectedCitizen(data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load citizen reward history.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f4f7] pb-14">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#fce6da] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#ad4f1b]">
              <IndianRupee className="h-4 w-4" aria-hidden="true" /> Rewards
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[#27334f] sm:text-4xl">Rewards & Payments</h1>
            <p className="mt-2 text-sm text-[#626b7d]">Review citizen balances and withdrawal requests.</p>
          </div>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="inline-flex items-center gap-2 rounded-full border border-[#dfe2e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#626b7d]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        </motion.header>

        {error && <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-error/20 bg-error/5 p-5 text-sm text-error"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p>{error}</p></div>}
        {notice && <div role="status" className="mb-6 rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">{notice}</div>}

        {selectedCitizen && (
          <section className="mb-8 rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-muted">Citizen reward history</p>
                <h2 className="mt-1 font-display text-xl font-bold text-brand-ink">{selectedCitizen.citizen.name}</h2>
                <p className="mt-1 text-xs text-neutral-muted">{selectedCitizen.citizen.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedCitizen(null)} className="rounded-full border border-neutral-light px-3 py-1.5 text-xs font-semibold text-neutral-muted">Close</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-brand-ink/5 p-3"><p className="text-xs text-neutral-muted">Points</p><p className="mt-1 font-bold text-brand-ink">{selectedCitizen.rewards.total_points}</p></div>
              <div className="rounded-xl bg-saffron-light/30 p-3"><p className="text-xs text-neutral-muted">Earned</p><p className="mt-1 font-bold text-neutral-text">{formatInr(selectedCitizen.rewards.total_amount_earned)}</p></div>
              <div className="rounded-xl bg-success/5 p-3"><p className="text-xs text-neutral-muted">Paid</p><p className="mt-1 font-bold text-success">{formatInr(selectedCitizen.rewards.total_amount_paid)}</p></div>
              <div className="rounded-xl bg-info/5 p-3"><p className="text-xs text-neutral-muted">Available</p><p className="mt-1 font-bold text-info">{formatInr(selectedCitizen.rewards.available_unpaid_balance)}</p></div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div><h3 className="text-sm font-bold text-brand-ink">Earned rewards</h3><ul className="mt-3 space-y-2">{selectedCitizen.rewards.transactions.map((item) => <li key={item.id} className="rounded-xl border border-neutral-light p-3 text-xs"><p className="font-semibold text-neutral-text">{formatInr(item.amount)} · Complaint #{item.complaint_id || '—'}</p><p className="mt-1 text-neutral-muted">Eligible {formatDate(item.eligibility_date)}</p></li>)}</ul></div>
              <div><h3 className="text-sm font-bold text-brand-ink">Withdrawals</h3><ul className="mt-3 space-y-2">{selectedCitizen.rewards.withdrawals.map((item) => <li key={item.id} className="rounded-xl border border-neutral-light p-3 text-xs"><p className="font-semibold text-neutral-text">{formatInr(item.requested_amount)} · {item.request_status}</p><p className="mt-1 text-neutral-muted">{formatDate(item.requested_at)}</p></li>)}</ul></div>
              <div><h3 className="text-sm font-bold text-brand-ink">Payment history</h3><ul className="mt-3 space-y-2">{selectedCitizen.rewards.payment_history.map((item) => <li key={item.id} className="rounded-xl border border-neutral-light p-3 text-xs"><p className="font-semibold text-neutral-text">{formatInr(item.amount)} · {item.payment_status}</p><p className="mt-1 text-neutral-muted">{item.payment_method} · {formatDate(item.initiated_at)}</p>{item.failure_reason && <p className="mt-1 text-error">{item.failure_reason}</p>}</li>)}</ul></div>
            </div>
          </section>
        )}

        <section className="mb-8 overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink">Citizen rewards</h2></div>
          {loading ? <p className="px-6 py-12 text-center text-sm text-neutral-muted">Loading citizen rewards…</p> : citizens.length === 0 ? <p className="px-6 py-12 text-center text-sm text-neutral-muted">No citizens found.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white/50 text-xs uppercase tracking-wider text-neutral-muted"><tr><th className="px-5 py-3">Citizen</th><th className="px-4 py-3">Complaints</th><th className="px-4 py-3">Submission</th><th className="px-4 py-3">Resolution</th><th className="px-4 py-3">Total points</th><th className="px-4 py-3">Earned</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Pending requests</th></tr></thead>
              <tbody className="divide-y divide-neutral-light">{citizens.map((citizen) => <tr key={citizen.citizen_id}><td className="px-5 py-4"><button type="button" onClick={() => openCitizenDetails(citizen.citizen_id)} className="text-left font-semibold text-neutral-text hover:text-brand-ink hover:underline">{citizen.citizen_name}<span className="mt-1 block text-xs font-normal text-neutral-muted">{citizen.email}</span></button></td><td className="px-4 py-4">{citizen.successfully_resolved_complaints}/{citizen.total_complaints_submitted}</td><td className="px-4 py-4">{Number(citizen.submission_reward_points || 0)}</td><td className="px-4 py-4">{Number(citizen.resolution_reward_points || 0)}</td><td className="px-4 py-4">{Number(citizen.total_points)}</td><td className="px-4 py-4">{formatInr(citizen.total_earned_amount)}</td><td className="px-4 py-4">{formatInr(citizen.total_paid_amount)}</td><td className="px-4 py-4 font-bold text-brand-ink">{formatInr(citizen.available_balance)}</td><td className="px-4 py-4">{Number(citizen.pending_withdrawals)}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
          <div className="border-b border-neutral-light px-5 py-5 sm:px-7"><h2 className="font-display text-xl font-bold text-brand-ink">Withdrawal requests</h2></div>
          {withdrawals.length === 0 ? <p className="px-6 py-12 text-center text-sm text-neutral-muted">No withdrawal requests.</p> : (
            <ul className="divide-y divide-neutral-light">{withdrawals.map((withdrawal) => (
              <li key={withdrawal.id} className="px-5 py-5 sm:px-7">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div><p className="text-sm font-bold text-neutral-text">{withdrawal.citizen_name}</p><p className="mt-1 text-xs text-neutral-muted">{formatInr(withdrawal.requested_amount)} · {withdrawal.is_early_withdrawal ? 'Early request' : 'Eligible request'} · {formatDate(withdrawal.requested_at)}</p></div>
                  <span className="w-fit rounded-full bg-brand-ink/5 px-3 py-1 text-xs font-bold text-brand-ink">{withdrawal.request_status}</span>
                </div>
                {withdrawal.request_status === 'REQUESTED' || withdrawal.request_status === 'UNDER_REVIEW' ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-light bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <label className="text-xs font-semibold text-neutral-text">
                      Rejection reason
                      <input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Required to reject" className="mt-2 w-full rounded-xl border border-neutral-light px-3 py-2.5 text-sm" />
                    </label>
                    <button type="button" onClick={() => review(withdrawal.id, 'approve')} className="inline-flex items-center justify-center gap-2 rounded-full bg-success px-4 py-2.5 text-xs font-bold text-white"><CheckCircle2 className="h-3.5 w-3.5" />Approve</button>
                    <button type="button" onClick={() => {
                      if (!rejectionReason.trim()) {
                        setError('Enter a rejection reason.');
                        return;
                      }
                      review(withdrawal.id, 'reject', rejectionReason);
                    }} className="inline-flex items-center justify-center gap-2 rounded-full border border-error/30 px-4 py-2.5 text-xs font-bold text-error"><XCircle className="h-3.5 w-3.5" />Reject</button>
                  </div>
                ) : null}
                {withdrawal.request_status === 'APPROVED' || withdrawal.request_status === 'PAYMENT_FAILED' ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-light bg-white p-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
                    <label className="text-xs font-semibold text-neutral-text">
                      Payment method
                      <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm">
                        <option value="UPI">Generic UPI</option>
                        <option value="PHONEPE">PhonePe</option>
                        <option value="GOOGLE_PAY">Google Pay</option>
                        <option value="PAYTM">Paytm</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-neutral-text">
                      Payment reference
                      <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional confirmed/reference ID" className="mt-2 w-full rounded-xl border border-neutral-light bg-white px-3 py-2.5 text-sm" />
                    </label>
                    <button type="button" onClick={() => initiatePayment(withdrawal)} className="rounded-full bg-brand-ink px-4 py-3 text-xs font-bold text-white">
                      Initiate record
                    </button>
                    <p className="text-[11px] text-neutral-muted sm:col-span-3">No recipient UPI ID or deep link is configured. Transfer the amount outside GramaMitra, then record the result explicitly.</p>
                  </div>
                ) : null}
                {withdrawal.request_status === 'PAYMENT_INITIATED' ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-light bg-white p-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-neutral-text">
                      Confirmed payment reference
                      <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional transaction/reference ID" className="mt-2 w-full rounded-xl border border-neutral-light px-3 py-2.5 text-sm" />
                    </label>
                    <label className="text-xs font-semibold text-neutral-text">
                      Failure reason
                      <input value={failureReason} onChange={(event) => setFailureReason(event.target.value)} placeholder="Required only if payment failed" className="mt-2 w-full rounded-xl border border-neutral-light px-3 py-2.5 text-sm" />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button type="button" onClick={() => confirmPayment(withdrawal, 'success')} className="rounded-full bg-success px-4 py-2 text-xs font-bold text-white">Confirm paid</button>
                      <button type="button" onClick={() => {
                        if (!failureReason.trim()) {
                          setError('Enter a payment failure reason.');
                          return;
                        }
                        confirmPayment(withdrawal, 'failed');
                      }} className="rounded-full border border-error/30 px-4 py-2 text-xs font-bold text-error">Payment failed</button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}</ul>
          )}
        </section>
      </main>
    </div>
  );
}
