-- Additive Citizen Rewards migration
-- Apply manually with an authorized MySQL administrator:
-- mysql -u <administrator> -p gramamitra_db < backend/src/models/migrations/20261123_citizen_rewards.sql
-- This migration performs no historical reward, balance, or withdrawal backfill.

SET @has_amount = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions' AND column_name = 'amount'
);
SET @has_earned_at = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions' AND column_name = 'earned_at'
);
SET @has_eligibility_date = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions' AND column_name = 'eligibility_date'
);
SET @has_citizen_id = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions' AND column_name = 'citizen_id'
);

SET @sql = IF(@has_amount = 0,
  'ALTER TABLE reward_transactions ADD COLUMN amount DECIMAL(12,2) NULL AFTER points',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_earned_at = 0,
  'ALTER TABLE reward_transactions ADD COLUMN earned_at DATETIME NULL AFTER description',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_eligibility_date = 0,
  'ALTER TABLE reward_transactions ADD COLUMN eligibility_date DATETIME NULL AFTER earned_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_citizen_id = 0,
  'ALTER TABLE reward_transactions ADD COLUMN citizen_id BIGINT NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_citizen_fk = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND constraint_name = 'fk_reward_transactions_citizen'
);
SET @sql = IF(@has_citizen_fk = 0,
  'ALTER TABLE reward_transactions ADD CONSTRAINT fk_reward_transactions_citizen FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_citizen_index = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND index_name = 'idx_reward_transactions_citizen_created'
);
SET @sql = IF(@has_citizen_index = 0,
  'CREATE INDEX idx_reward_transactions_citizen_created ON reward_transactions (citizen_id, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_completion_index = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND index_name = 'uq_reward_completion_per_complaint'
);
SET @has_completion_generated = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND column_name = 'completion_reward_complaint_id'
);
SET @sql = IF(@has_completion_generated = 0,
  'ALTER TABLE reward_transactions ADD COLUMN completion_reward_complaint_id BIGINT GENERATED ALWAYS AS (CASE WHEN transaction_type = ''completion'' THEN complaint_id ELSE NULL END) STORED',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @duplicate_completion_count = (
  SELECT COUNT(*) FROM (
    SELECT transaction_type, complaint_id
    FROM reward_transactions
    WHERE transaction_type = 'completion' AND complaint_id IS NOT NULL
    GROUP BY transaction_type, complaint_id
    HAVING COUNT(*) > 1
  ) duplicate_completion_rewards
);
SET @sql = IF(@has_completion_index = 0 AND @duplicate_completion_count = 0,
  'CREATE UNIQUE INDEX uq_reward_completion_per_complaint ON reward_transactions (completion_reward_complaint_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_submission_generated = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND column_name = 'submission_reward_complaint_id'
);
SET @sql = IF(@has_submission_generated = 0,
  'ALTER TABLE reward_transactions ADD COLUMN submission_reward_complaint_id BIGINT GENERATED ALWAYS AS (CASE WHEN transaction_type = ''submission'' THEN complaint_id ELSE NULL END) STORED',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_submission_index = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND index_name = 'uq_reward_submission_per_complaint'
);
SET @sql = IF(@has_submission_index = 0,
  'CREATE UNIQUE INDEX uq_reward_submission_per_complaint ON reward_transactions (submission_reward_complaint_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_resolution_generated = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND column_name = 'resolution_reward_complaint_id'
);
SET @sql = IF(@has_resolution_generated = 0,
  'ALTER TABLE reward_transactions ADD COLUMN resolution_reward_complaint_id BIGINT GENERATED ALWAYS AS (CASE WHEN transaction_type IN (''resolution'',''completion'') THEN complaint_id ELSE NULL END) STORED',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_resolution_index = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'reward_transactions'
    AND index_name = 'uq_reward_resolution_per_complaint'
);
SET @sql = IF(@has_resolution_index = 0,
  'CREATE UNIQUE INDEX uq_reward_resolution_per_complaint ON reward_transactions (resolution_reward_complaint_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS citizen_rewards (
  citizen_id BIGINT NOT NULL PRIMARY KEY,
  total_points INT NOT NULL DEFAULT 0,
  total_earned_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  available_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_citizen_rewards_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_citizen_rewards_nonnegative
    CHECK (total_points >= 0 AND total_earned_amount >= 0 AND total_paid_amount >= 0 AND available_balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reward_withdrawals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  citizen_id BIGINT NOT NULL,
  requested_amount DECIMAL(12,2) NOT NULL,
  request_status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
  is_early_withdrawal BOOLEAN NOT NULL DEFAULT FALSE,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  payment_method VARCHAR(30) NULL,
  payment_initiated_at DATETIME NULL,
  paid_at DATETIME NULL,
  rejection_reason TEXT NULL,
  payment_reference VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reward_withdrawals_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_withdrawals_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_reward_withdrawal_amount
    CHECK (requested_amount >= 0),
  INDEX idx_reward_withdrawals_citizen_status (citizen_id, request_status),
  INDEX idx_reward_withdrawals_status_requested (request_status, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reward_payment_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  withdrawal_id BIGINT NOT NULL,
  citizen_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  payment_reference VARCHAR(255) NULL,
  initiated_by BIGINT NOT NULL,
  initiated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_by BIGINT NULL,
  confirmed_at DATETIME NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'PAYMENT_INITIATED',
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reward_payment_withdrawal
    FOREIGN KEY (withdrawal_id) REFERENCES reward_withdrawals(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_payment_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_payment_initiator
    FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_payment_confirmer
    FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_reward_payment_amount
    CHECK (amount >= 0),
  INDEX idx_reward_payment_withdrawal_status (withdrawal_id, payment_status),
  INDEX idx_reward_payment_citizen_created (citizen_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
