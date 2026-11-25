import pool, { query } from '../src/config/db.js';

try {
  const missingBalanceRows = await query(`
    SELECT u.id AS citizen_id, u.full_name
    FROM users u
    LEFT JOIN citizen_rewards cr ON cr.citizen_id = u.id
    WHERE u.role = 'citizen'
      AND cr.citizen_id IS NULL
      AND EXISTS (
        SELECT 1 FROM reward_transactions rt
        WHERE rt.citizen_id = u.id
           OR rt.user_id = u.id
      )
    ORDER BY u.id
  `);

  const resolvedWithoutTransaction = await query(`
    SELECT c.id, c.complaint_number, c.citizen_id, c.resolved_at
    FROM complaints c
    LEFT JOIN reward_transactions rt
      ON rt.complaint_id = c.id
     AND rt.transaction_type IN ('completion', 'resolution')
    WHERE c.status = 'resolved'
      AND rt.id IS NULL
    ORDER BY c.id
  `);

  const duplicateTransactions = await query(`
    SELECT complaint_id, transaction_type, COUNT(*) AS transaction_count
    FROM reward_transactions
    WHERE transaction_type IN ('submission', 'resolution', 'completion')
      AND complaint_id IS NOT NULL
    GROUP BY complaint_id, transaction_type
    HAVING COUNT(*) > 1
    ORDER BY complaint_id
  `);

  const amountDiscrepancies = await query(`
    SELECT rt.complaint_id,
           rt.points,
           rt.amount,
           COALESCE(cr.available_balance, 0) AS available_balance,
           COALESCE(cr.total_points, 0) AS balance_points,
           COALESCE(cr.total_earned_amount, 0) AS balance_earned
    FROM reward_transactions rt
    LEFT JOIN citizen_rewards cr ON cr.citizen_id = rt.citizen_id
    WHERE rt.transaction_type IN ('submission', 'resolution', 'completion')
      AND (rt.points <> 1 OR rt.amount IS NULL OR rt.amount <> 10.00)
    ORDER BY rt.complaint_id
  `);

  const completionTotals = await query(`
    SELECT COALESCE(rt.citizen_id, rt.user_id) AS citizen_id,
           COUNT(*) AS transaction_count,
           SUM(rt.points) AS transaction_points,
           SUM(COALESCE(rt.amount, 0)) AS transaction_amount
    FROM reward_transactions rt
    WHERE rt.transaction_type IN ('submission', 'resolution', 'completion')
    GROUP BY COALESCE(rt.citizen_id, rt.user_id)
  `);

  const balanceTotals = await query(`
    SELECT citizen_id, total_points, total_earned_amount,
           total_paid_amount, available_balance
    FROM citizen_rewards
  `);

  const rows = [];
  const balanceByCitizen = new Map(balanceTotals.rows.map((row) => [String(row.citizen_id), row]));
  for (const total of completionTotals.rows) {
    const balance = balanceByCitizen.get(String(total.citizen_id));
    rows.push({
      citizen_id: total.citizen_id,
      transaction_count: Number(total.transaction_count),
      transaction_points: Number(total.transaction_points),
      transaction_amount: Number(total.transaction_amount),
      balance_points: balance ? Number(balance.total_points) : null,
      balance_earned: balance ? Number(balance.total_earned_amount) : null,
      discrepancy: !balance
        || Number(balance.total_points) !== Number(total.transaction_points)
        || Number(balance.total_earned_amount) !== Number(total.transaction_amount),
    });
  }

  console.log(JSON.stringify({
    mode: 'READ_ONLY',
    missingBalanceRows: missingBalanceRows.rows,
    resolvedComplaintsWithoutCompletionTransaction: resolvedWithoutTransaction.rows,
    duplicateCompletionTransactions: duplicateTransactions.rows,
    malformedCompletionAmounts: amountDiscrepancies.rows,
    citizenReconciliation: rows,
  }, null, 2));
} finally {
  await pool.end();
}
