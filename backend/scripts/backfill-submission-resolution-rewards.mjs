import pool, { withTransaction } from '../src/config/db.js';

const summary = {
  submissionRewardsAdded: 0,
  resolutionRewardsAdded: 0,
  existingSubmissionRewardsPreserved: 0,
  existingResolutionRewardsPreserved: 0,
  citizenBalancesRecalculated: 0,
};

await withTransaction(async (transactionQuery) => {
  const complaintResult = await transactionQuery(
    `SELECT id, citizen_id, created_at, status, resolved_at
     FROM complaints
     WHERE citizen_id IS NOT NULL
     ORDER BY id`
  );

  for (const complaint of complaintResult.rows) {
    const submission = await transactionQuery(
      `SELECT id
       FROM reward_transactions
       WHERE transaction_type = 'submission'
         AND complaint_id = ?
       LIMIT 1
       FOR UPDATE`,
      [complaint.id]
    );
    if (submission.rows.length === 0) {
      const earnedAt = complaint.created_at;
      const eligibilityDate = new Date(earnedAt);
      eligibilityDate.setMonth(eligibilityDate.getMonth() + 6);
      await transactionQuery(
        `INSERT INTO reward_transactions (
          user_id, citizen_id, complaint_id, points, amount,
          transaction_type, description, earned_at, eligibility_date, created_at
        ) VALUES (?, ?, ?, 1, 10.00, 'submission',
                  'Historical reward for complaint submission',
                  ?, ?, ?)`,
        [
          complaint.citizen_id,
          complaint.citizen_id,
          complaint.id,
          earnedAt,
          eligibilityDate,
          earnedAt,
        ]
      );
      summary.submissionRewardsAdded += 1;
    } else {
      summary.existingSubmissionRewardsPreserved += 1;
    }

    if (complaint.status === 'resolved') {
      const resolution = await transactionQuery(
        `SELECT id
         FROM reward_transactions
         WHERE transaction_type IN ('resolution', 'completion')
           AND complaint_id = ?
         LIMIT 1
         FOR UPDATE`,
        [complaint.id]
      );
      if (resolution.rows.length === 0) {
        const earnedAt = complaint.resolved_at || complaint.created_at;
        const eligibilityDate = new Date(earnedAt);
        eligibilityDate.setMonth(eligibilityDate.getMonth() + 6);
        await transactionQuery(
          `INSERT INTO reward_transactions (
            user_id, citizen_id, complaint_id, points, amount,
            transaction_type, description, earned_at, eligibility_date, created_at
          ) VALUES (?, ?, ?, 1, 10.00, 'resolution',
                    'Reward for officially resolved complaint',
                    ?, ?, ?)`,
          [
            complaint.citizen_id,
            complaint.citizen_id,
            complaint.id,
            earnedAt,
            eligibilityDate,
            earnedAt,
          ]
        );
        summary.resolutionRewardsAdded += 1;
      } else {
        summary.existingResolutionRewardsPreserved += 1;
      }
    }
  }

  const citizens = await transactionQuery(
    `SELECT DISTINCT citizen_id
     FROM complaints
     WHERE citizen_id IS NOT NULL
     ORDER BY citizen_id`
  );

  for (const citizen of citizens.rows) {
    const balance = await transactionQuery(
      `SELECT COALESCE(SUM(points), 0) AS total_points,
              COALESCE(SUM(amount), 0) AS total_earned_amount
       FROM reward_transactions
       WHERE citizen_id = ?`,
      [citizen.citizen_id]
    );
    const totals = balance.rows[0];
    await transactionQuery(
      `INSERT INTO citizen_rewards (
        citizen_id, total_points, total_earned_amount,
        total_paid_amount, available_balance
      ) VALUES (?, ?, ?, 0.00, ?)
      ON DUPLICATE KEY UPDATE
        total_points = VALUES(total_points),
        total_earned_amount = VALUES(total_earned_amount),
        available_balance = GREATEST(
          0,
          VALUES(total_earned_amount) - total_paid_amount
        ),
        updated_at = CURRENT_TIMESTAMP`,
      [
        citizen.citizen_id,
        Number(totals.total_points),
        Number(totals.total_earned_amount),
        Number(totals.total_earned_amount),
      ]
    );
    summary.citizenBalancesRecalculated += 1;
  }
});

console.log(JSON.stringify(summary, null, 2));
await pool.end();
