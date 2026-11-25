import { query, withTransaction } from '../config/db.js';

export const REWARD_POINT_VALUE_INR = 10;

const toDecimal = (value) => Number((Number(value || 0)).toFixed(2));

const rewardEligibilityDate = (earnedDate) => {
  const date = earnedDate instanceof Date ? earnedDate : new Date(earnedDate);
  const eligibilityDate = new Date(date);
  eligibilityDate.setMonth(eligibilityDate.getMonth() + 6);
  return eligibilityDate;
};

export const addComplaintSubmissionReward = async (transactionQuery, complaint) => {
  if (!complaint?.id || !complaint?.citizen_id) return null;

  const existing = await transactionQuery(
    `SELECT id
     FROM reward_transactions
     WHERE transaction_type = 'submission'
       AND complaint_id = ?
     LIMIT 1
     FOR UPDATE`,
    [complaint.id]
  );
  if (existing.rows.length > 0) return null;

  const earnedDate = complaint.created_at instanceof Date
    ? complaint.created_at
    : new Date(complaint.created_at || new Date());
  const eligibilityDate = rewardEligibilityDate(earnedDate);

  await transactionQuery(
    `INSERT INTO reward_transactions (
      user_id, citizen_id, complaint_id, points, amount, transaction_type,
      description, earned_at, eligibility_date, created_at
    ) VALUES (?, ?, ?, 1, ?, 'submission', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      complaint.citizen_id,
      complaint.citizen_id,
      complaint.id,
      REWARD_POINT_VALUE_INR,
      'Reward for successful complaint submission',
      earnedDate,
      eligibilityDate,
    ]
  );
  await transactionQuery(
    `INSERT INTO citizen_rewards (
      citizen_id, total_points, total_earned_amount, total_paid_amount, available_balance
    ) VALUES (?, 1, ?, 0.00, ?)
    ON DUPLICATE KEY UPDATE
      total_points = total_points + 1,
      total_earned_amount = total_earned_amount + VALUES(total_earned_amount),
      available_balance = available_balance + VALUES(available_balance),
      updated_at = CURRENT_TIMESTAMP`,
    [complaint.citizen_id, REWARD_POINT_VALUE_INR, REWARD_POINT_VALUE_INR]
  );
  return { citizenId: complaint.citizen_id, complaintId: complaint.id, points: 1, amount: 10 };
};

export const complaintRewardForResolution = async (transactionQuery, complaint) => {
  if (!complaint || complaint.status !== 'resolved' || !complaint.citizen_id) return null;

  const existing = await transactionQuery(
    `SELECT id
     FROM reward_transactions
     WHERE transaction_type IN ('completion', 'resolution')
       AND complaint_id = ?
     LIMIT 1
     FOR UPDATE`,
    [complaint.id]
  );
  if (existing.rows.length > 0) return null;

  const earnedAt = complaint.resolved_at || new Date();
  const earnedDate = earnedAt instanceof Date ? earnedAt : new Date(earnedAt);
  const eligibilityDate = new Date(earnedDate);
  eligibilityDate.setMonth(eligibilityDate.getMonth() + 6);

  await transactionQuery(
    `INSERT INTO reward_transactions (
      user_id, citizen_id, complaint_id, points, amount, transaction_type,
      description, earned_at, eligibility_date, created_at
    ) VALUES (?, ?, ?, 1, ?, 'resolution', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      complaint.citizen_id,
      complaint.citizen_id,
      complaint.id,
      REWARD_POINT_VALUE_INR,
      'Reward for officially resolved complaint',
      earnedDate,
      eligibilityDate,
    ]
  );

  await transactionQuery(
    `INSERT INTO citizen_rewards (
      citizen_id, total_points, total_earned_amount, total_paid_amount, available_balance
    ) VALUES (?, 1, ?, 0.00, ?)
    ON DUPLICATE KEY UPDATE
      total_points = total_points + 1,
      total_earned_amount = total_earned_amount + VALUES(total_earned_amount),
      available_balance = available_balance + VALUES(available_balance),
      updated_at = CURRENT_TIMESTAMP`,
    [complaint.citizen_id, REWARD_POINT_VALUE_INR, REWARD_POINT_VALUE_INR]
  );
  return {
    citizenId: complaint.citizen_id,
    complaintId: complaint.id,
    points: 1,
    amount: REWARD_POINT_VALUE_INR,
  };
};

export const getCitizenRewardSummary = async (citizenId) => {
  const [rewardResult, submissionResult, resolutionResult, eligibleResult, waitingResult, resolvedResult, submittedResult, transactions, withdrawals, paymentHistory] =
    await Promise.all([
      query(
        `SELECT citizen_id, total_points, total_earned_amount,
                total_paid_amount, available_balance
         FROM citizen_rewards
         WHERE citizen_id = ?`,
        [citizenId]
      ),
      query(
        `SELECT COALESCE(SUM(points), 0) AS points,
                COALESCE(SUM(amount), 0) AS amount
         FROM reward_transactions
         WHERE citizen_id = ? AND transaction_type = 'submission'`,
        [citizenId]
      ),
      query(
        `SELECT COALESCE(SUM(points), 0) AS points,
                COALESCE(SUM(amount), 0) AS amount
         FROM reward_transactions
         WHERE citizen_id = ? AND transaction_type IN ('resolution', 'completion')`,
        [citizenId]
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) AS eligible_amount
         FROM reward_transactions
         WHERE citizen_id = ? AND transaction_type IN ('submission', 'resolution', 'completion')
           AND eligibility_date <= CURRENT_TIMESTAMP`,
        [citizenId]
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) AS waiting_amount
         FROM reward_transactions
         WHERE citizen_id = ? AND transaction_type IN ('submission', 'resolution', 'completion')
           AND eligibility_date > CURRENT_TIMESTAMP`,
        [citizenId]
      ),
      query(
        `SELECT COUNT(*) AS count
         FROM complaints
         WHERE citizen_id = ? AND status = 'resolved'`,
        [citizenId]
      ),
      query(
        `SELECT COUNT(*) AS count
         FROM complaints
         WHERE citizen_id = ?`,
        [citizenId]
      ),
      query(
        `SELECT id, complaint_id, points, amount, transaction_type,
                description, earned_at, eligibility_date, created_at
         FROM reward_transactions
         WHERE citizen_id = ?
         ORDER BY earned_at DESC, created_at DESC
         LIMIT 200`,
        [citizenId]
      ),
      query(
        `SELECT id, requested_amount, request_status, is_early_withdrawal,
                requested_at, reviewed_by, reviewed_at, payment_method,
                payment_initiated_at, paid_at, rejection_reason, payment_reference
         FROM reward_withdrawals
         WHERE citizen_id = ?
         ORDER BY requested_at DESC
         LIMIT 100`,
        [citizenId]
      ),
      query(
        `SELECT h.id, h.withdrawal_id, h.amount, h.payment_method,
                h.payment_reference, h.initiated_by, h.initiated_at,
                h.confirmed_by, h.confirmed_at, h.payment_status, h.failure_reason
         FROM reward_payment_history h
         WHERE h.citizen_id = ?
         ORDER BY h.initiated_at DESC
         LIMIT 100`,
        [citizenId]
      ),
    ]);

  const reward = rewardResult.rows[0] || {
    citizen_id: citizenId,
    total_points: 0,
    total_earned_amount: 0,
    total_paid_amount: 0,
    available_balance: 0,
  };
  const totalEarned = toDecimal(reward.total_earned_amount);
  const totalPaid = toDecimal(reward.total_paid_amount);
  const available = toDecimal(reward.available_balance);
  const eligible = toDecimal(eligibleResult.rows[0]?.eligible_amount || 0);
  const waiting = toDecimal(waitingResult.rows[0]?.waiting_amount || 0);
  return {
    citizen_id: citizenId,
    total_complaints_submitted: Number(submittedResult.rows[0]?.count || 0),
    successfully_resolved_complaints: Number(resolvedResult.rows[0]?.count || 0),
    total_points: Number(reward.total_points || 0),
    submission_reward_points: Number(submissionResult.rows[0]?.points || 0),
    submission_reward_amount: toDecimal(submissionResult.rows[0]?.amount || 0),
    resolution_reward_points: Number(resolutionResult.rows[0]?.points || 0),
    resolution_reward_amount: toDecimal(resolutionResult.rows[0]?.amount || 0),
    total_amount_earned: totalEarned,
    total_amount_paid: totalPaid,
    available_unpaid_balance: available,
    eligible_withdrawal_amount: eligible,
    waiting_for_eligibility_amount: waiting,
    transactions: transactions.rows,
    withdrawals: withdrawals.rows,
    payment_history: paymentHistory.rows,
  };
};

export const listCitizenRewardSummaries = async () => {
  const result = await query(
    `SELECT u.id AS citizen_id, u.full_name AS citizen_name, u.email,
            COALESCE(cr.total_points, 0) AS total_points,
            COALESCE(cr.total_earned_amount, 0) AS total_earned_amount,
            COALESCE(cr.total_paid_amount, 0) AS total_paid_amount,
            COALESCE(cr.available_balance, 0) AS available_balance,
            (SELECT COALESCE(SUM(points), 0) FROM reward_transactions rt
             WHERE rt.citizen_id = u.id AND rt.transaction_type = 'submission') AS submission_reward_points,
            (SELECT COALESCE(SUM(points), 0) FROM reward_transactions rt
             WHERE rt.citizen_id = u.id AND rt.transaction_type IN ('resolution', 'completion')) AS resolution_reward_points,
            (SELECT COUNT(*) FROM complaints c WHERE c.citizen_id = u.id) AS total_complaints_submitted,
            (SELECT COUNT(*) FROM complaints c WHERE c.citizen_id = u.id AND c.status = 'resolved') AS successfully_resolved_complaints,
            (SELECT COUNT(*) FROM reward_withdrawals rw
             WHERE rw.citizen_id = u.id
               AND rw.request_status IN ('REQUESTED', 'UNDER_REVIEW', 'PAYMENT_INITIATED')) AS pending_withdrawals
     FROM users u
     LEFT JOIN citizen_rewards cr ON cr.citizen_id = u.id
     WHERE u.role = 'citizen'
     ORDER BY u.full_name ASC`
  );
  return result.rows;
};
