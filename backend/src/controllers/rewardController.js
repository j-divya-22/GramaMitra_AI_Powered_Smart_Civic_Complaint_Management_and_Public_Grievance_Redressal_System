import { asyncHandler } from '../middleware/errorHandler.js';
import { query, withTransaction } from '../config/db.js';
import {
  getCitizenRewardSummary,
  listCitizenRewardSummaries,
  REWARD_POINT_VALUE_INR,
} from '../services/rewardService.js';
import { logAuditEvent } from '../services/auditLog.js';

const money = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Number(parsed.toFixed(2));
  }
  return null;
};

export const getMyRewards = asyncHandler(async (req, res) => {
  res.json({ rewards: await getCitizenRewardSummary(req.user.id) });
});

export const getAdminRewards = asyncHandler(async (req, res) => {
  res.json({ citizens: await listCitizenRewardSummaries() });
});

export const getAdminCitizenRewards = asyncHandler(async (req, res) => {
  const citizenId = req.params.citizenId;
  if (!citizenId) return res.status(400).json({ error: 'Citizen identifier is required.' });
  const citizenResult = await query(
    'SELECT id, full_name AS name, email, phone FROM users WHERE id = ? AND role = ?',
    [citizenId, 'citizen']
  );
  if (citizenResult.rows.length === 0) {
    return res.status(404).json({ error: 'Citizen not found.' });
  }
  res.json({
    citizen: citizenResult.rows[0],
    rewards: await getCitizenRewardSummary(citizenId),
  });
});

export const requestRewardWithdrawal = asyncHandler(async (req, res) => {
  const requestedAmount = money(req.body?.requested_amount);
  if (requestedAmount === null || requestedAmount <= 0) {
    return res.status(400).json({ error: 'Enter a valid requested amount.' });
  }
  if (Math.round(requestedAmount * 100) !== requestedAmount * 100) {
    return res.status(400).json({ error: 'Requested amount can have at most two decimal places.' });
  }
  const isEarly = req.body?.early_withdrawal === true;
  const result = await withTransaction(async (transactionQuery) => {
    const rewardResult = await transactionQuery(
      `SELECT available_balance
       FROM citizen_rewards
       WHERE citizen_id = ?
       FOR UPDATE`,
      [req.user.id]
    );
    if (rewardResult.rows.length === 0) {
      const error = new Error('No reward balance is available.');
      error.statusCode = 400;
      throw error;
    }
    const availableBalance = money(rewardResult.rows[0].available_balance);
    if (availableBalance === null || requestedAmount > availableBalance) {
      const error = new Error('The requested amount exceeds the available balance.');
      error.statusCode = 400;
      throw error;
    }
    const reservedResult = await transactionQuery(
      `SELECT COALESCE(SUM(requested_amount), 0) AS reserved_amount
       FROM reward_withdrawals
       WHERE citizen_id = ?
         AND request_status IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PAYMENT_INITIATED')`,
      [req.user.id]
    );
    const reservedAmount = money(reservedResult.rows[0]?.reserved_amount);
    if (reservedAmount === null || requestedAmount + reservedAmount > availableBalance) {
      const error = new Error('The requested amount exceeds the balance remaining after pending withdrawal requests.');
      error.statusCode = 400;
      throw error;
    }
    if (!isEarly) {
      const eligibleResult = await transactionQuery(
        `SELECT COALESCE(SUM(amount), 0) AS eligible_amount
         FROM reward_transactions
         WHERE citizen_id = ? AND transaction_type = 'completion'
           AND eligibility_date <= CURRENT_TIMESTAMP`,
        [req.user.id]
      );
      const eligibleAmount = money(eligibleResult.rows[0]?.eligible_amount);
      if (eligibleAmount === null || requestedAmount > eligibleAmount) {
        const error = new Error('The requested amount is not yet eligible for withdrawal.');
        error.statusCode = 400;
        throw error;
      }
    }
    const insert = await transactionQuery(
      `INSERT INTO reward_withdrawals (
        citizen_id, requested_amount, request_status, is_early_withdrawal
      ) VALUES (?, ?, 'REQUESTED', ?)`,
      [req.user.id, requestedAmount, isEarly]
    );
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: 'reward.withdrawal_requested',
      entityType: 'reward_withdrawal',
      entityId: insert.insertId,
      details: {
        requested_amount: requestedAmount,
        is_early_withdrawal: isEarly,
      },
    });
    return insert.insertId;
  });
  res.status(201).json({
    message: 'Withdrawal request submitted.',
    withdrawal_id: result,
  });
});

export const getAdminWithdrawalRequests = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT rw.id, rw.citizen_id, u.full_name AS citizen_name, u.email,
            rw.requested_amount, rw.request_status, rw.is_early_withdrawal,
            rw.requested_at, rw.reviewed_by, rw.reviewed_at,
            rw.payment_method, rw.payment_initiated_at, rw.paid_at,
            rw.rejection_reason, rw.payment_reference
     FROM reward_withdrawals rw
     JOIN users u ON u.id = rw.citizen_id
     ORDER BY rw.requested_at DESC
     LIMIT 200`
  );
  res.json({ withdrawals: result.rows });
});

export const reviewRewardWithdrawal = asyncHandler(async (req, res) => {
  const withdrawalId = req.params.withdrawalId;
  const action = typeof req.body?.action === 'string' ? req.body.action.toLowerCase() : '';
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Choose approve or reject.' });
  }
  const rejectionReason = typeof req.body?.rejection_reason === 'string'
    ? req.body.rejection_reason.trim()
    : '';
  if (action === 'reject' && !rejectionReason) {
    return res.status(400).json({ error: 'A rejection reason is required.' });
  }
  await withTransaction(async (transactionQuery) => {
    const result = await transactionQuery(
      `SELECT id, citizen_id, requested_amount, request_status
       FROM reward_withdrawals
       WHERE id = ?
       FOR UPDATE`,
      [withdrawalId]
    );
    if (result.rows.length === 0) {
      const error = new Error('Withdrawal request not found.');
      error.statusCode = 404;
      throw error;
    }
    const withdrawal = result.rows[0];
    if (!['REQUESTED', 'UNDER_REVIEW'].includes(withdrawal.request_status)) {
      const error = new Error('This withdrawal request has already been reviewed.');
      error.statusCode = 409;
      throw error;
    }
    await transactionQuery(
      `UPDATE reward_withdrawals
       SET request_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           rejection_reason = ?
       WHERE id = ?`,
      [
        action === 'approve' ? 'APPROVED' : 'REJECTED',
        req.user.id,
        action === 'reject' ? rejectionReason : null,
        withdrawalId,
      ]
    );
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: `reward.withdrawal_${action}d`,
      entityType: 'reward_withdrawal',
      entityId: withdrawalId,
      details: {
        citizen_id: withdrawal.citizen_id,
        requested_amount: withdrawal.requested_amount,
        rejection_reason: action === 'reject' ? rejectionReason : null,
      },
    });
  });
  res.json({ message: action === 'approve' ? 'Withdrawal approved.' : 'Withdrawal rejected.' });
});

export const initiateRewardPayment = asyncHandler(async (req, res) => {
  const withdrawalId = req.params.withdrawalId;
  const paymentMethod = typeof req.body?.payment_method === 'string'
    ? req.body.payment_method.trim().toUpperCase()
    : '';
  if (!['PHONEPE', 'GOOGLE_PAY', 'PAYTM', 'UPI'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Choose PHONEPE, GOOGLE_PAY, PAYTM, or UPI.' });
  }
  const paymentReference = typeof req.body?.payment_reference === 'string'
    ? req.body.payment_reference.trim()
    : '';
  await withTransaction(async (transactionQuery) => {
    const result = await transactionQuery(
      `SELECT id, citizen_id, requested_amount, request_status
       FROM reward_withdrawals
       WHERE id = ?
       FOR UPDATE`,
      [withdrawalId]
    );
    if (result.rows.length === 0) {
      const error = new Error('Withdrawal request not found.');
      error.statusCode = 404;
      throw error;
    }
    const withdrawal = result.rows[0];
    if (!['APPROVED', 'PAYMENT_FAILED'].includes(withdrawal.request_status)) {
      const error = new Error('Only approved or previously failed withdrawal requests can initiate payment.');
      error.statusCode = 409;
      throw error;
    }
    const existingHistory = await transactionQuery(
      `SELECT id
       FROM reward_payment_history
       WHERE withdrawal_id = ? AND payment_status = 'PAYMENT_INITIATED'
       LIMIT 1
       FOR UPDATE`,
      [withdrawalId]
    );
    if (existingHistory.rows.length > 0) {
      const error = new Error('Payment initiation already exists for this withdrawal.');
      error.statusCode = 409;
      throw error;
    }
    await transactionQuery(
      `UPDATE reward_withdrawals
       SET request_status = 'PAYMENT_INITIATED',
           payment_method = ?, payment_initiated_at = CURRENT_TIMESTAMP,
           payment_reference = NULLIF(?, '')
       WHERE id = ?`,
      [paymentMethod, paymentReference, withdrawalId]
    );
    await transactionQuery(
      `INSERT INTO reward_payment_history (
        withdrawal_id, citizen_id, amount, payment_method, payment_reference,
        initiated_by, initiated_at, payment_status
      ) VALUES (?, ?, ?, ?, NULLIF(?, ''), ?, CURRENT_TIMESTAMP, 'PAYMENT_INITIATED')`,
      [
        withdrawalId,
        withdrawal.citizen_id,
        withdrawal.requested_amount,
        paymentMethod,
        paymentReference,
        req.user.id,
      ]
    );
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: 'reward.payment_initiated',
      entityType: 'reward_withdrawal',
      entityId: withdrawalId,
      details: {
        payment_method: paymentMethod,
        amount: withdrawal.requested_amount,
        payment_reference: paymentReference || null,
      },
    });
  });
  res.json({
    message: 'Payment initiation recorded. Money is not paid until an admin confirms it.',
  });
});

export const confirmRewardPayment = asyncHandler(async (req, res) => {
  const withdrawalId = req.params.withdrawalId;
  const outcome = typeof req.body?.outcome === 'string'
    ? req.body.outcome.toLowerCase()
    : '';
  if (!['success', 'failed'].includes(outcome)) {
    return res.status(400).json({ error: 'Choose success or failed.' });
  }
  const paymentReference = typeof req.body?.payment_reference === 'string'
    ? req.body.payment_reference.trim()
    : '';
  const failureReason = typeof req.body?.failure_reason === 'string'
    ? req.body.failure_reason.trim()
    : '';
  await withTransaction(async (transactionQuery) => {
    const withdrawalResult = await transactionQuery(
      `SELECT id, citizen_id, requested_amount, request_status
       FROM reward_withdrawals
       WHERE id = ?
       FOR UPDATE`,
      [withdrawalId]
    );
    if (withdrawalResult.rows.length === 0) {
      const error = new Error('Withdrawal request not found.');
      error.statusCode = 404;
      throw error;
    }
    const withdrawal = withdrawalResult.rows[0];
    if (withdrawal.request_status !== 'PAYMENT_INITIATED') {
      const error = new Error('Payment is not awaiting confirmation.');
      error.statusCode = 409;
      throw error;
    }

    const historyResult = await transactionQuery(
      `SELECT id
       FROM reward_payment_history
       WHERE withdrawal_id = ? AND payment_status = 'PAYMENT_INITIATED'
       ORDER BY initiated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [withdrawalId]
    );
    if (historyResult.rows.length === 0) {
      const error = new Error('No initiated payment record exists.');
      error.statusCode = 409;
      throw error;
    }

    if (outcome === 'success') {
      const rewardResult = await transactionQuery(
        `SELECT available_balance
         FROM citizen_rewards
         WHERE citizen_id = ?
         FOR UPDATE`,
        [withdrawal.citizen_id]
      );
      if (rewardResult.rows.length === 0) {
        const error = new Error('Citizen reward balance not found.');
        error.statusCode = 409;
        throw error;
      }
      const available = money(rewardResult.rows[0].available_balance);
      if (available === null || withdrawal.requested_amount > available) {
        const error = new Error('Payment cannot exceed the citizen available balance.');
        error.statusCode = 409;
        throw error;
      }
      await transactionQuery(
        `UPDATE citizen_rewards
         SET total_paid_amount = total_paid_amount + ?,
             available_balance = available_balance - ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE citizen_id = ?`,
        [withdrawal.requested_amount, withdrawal.requested_amount, withdrawal.citizen_id]
      );
      await transactionQuery(
        `UPDATE reward_withdrawals
         SET request_status = 'PAID',
             paid_at = CURRENT_TIMESTAMP,
             payment_reference = COALESCE(NULLIF(?, ''), payment_reference)
         WHERE id = ?`,
        [paymentReference, withdrawalId]
      );
      await transactionQuery(
        `UPDATE reward_payment_history
         SET payment_status = 'PAID',
             confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP,
             payment_reference = COALESCE(NULLIF(?, ''), payment_reference)
         WHERE id = ?`,
        [req.user.id, paymentReference, historyResult.rows[0].id]
      );
    } else {
      await transactionQuery(
        `UPDATE reward_withdrawals
         SET request_status = 'PAYMENT_FAILED',
             rejection_reason = NULL
         WHERE id = ?`,
        [withdrawalId]
      );
      await transactionQuery(
        `UPDATE reward_payment_history
         SET payment_status = 'PAYMENT_FAILED',
             confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP,
             failure_reason = NULLIF(?, '')
         WHERE id = ?`,
        [req.user.id, failureReason, historyResult.rows[0].id]
      );
    }
    await logAuditEvent(transactionQuery, {
      userId: req.user.id,
      action: `reward.payment_${outcome === 'success' ? 'confirmed' : 'failed'}`,
      entityType: 'reward_withdrawal',
      entityId: withdrawalId,
      details: {
        outcome,
        payment_reference: paymentReference || null,
        failure_reason: outcome === 'failed' ? failureReason : null,
      },
    });
  });
  res.json({
    message: outcome === 'success'
      ? 'Payment confirmed and citizen balance updated.'
      : 'Payment failure recorded; the citizen balance remains unpaid.',
  });
});
