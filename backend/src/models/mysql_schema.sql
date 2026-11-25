-- Gramamitra MySQL 8 schema.
-- Uploaded image binaries belong in uploads/complaints; only relative paths are stored here.
-- Completion reward rows must use transaction_type = 'completion'.

CREATE DATABASE IF NOT EXISTS gramamitra_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE gramamitra_db;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'admin') NOT NULL DEFAULT 'citizen',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_active (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_number VARCHAR(40) NOT NULL UNIQUE,
  citizen_id BIGINT NOT NULL,
  assigned_admin_id BIGINT NULL,
  category VARCHAR(100),
  original_text TEXT,
  english_text TEXT,
  generated_title VARCHAR(255),
  generated_description TEXT,
  priority VARCHAR(30),
  status VARCHAR(30) DEFAULT 'Submitted',
  address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  incident_date DATE,
  resolved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaints_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_complaints_assigned_admin
    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_complaints_citizen_created (citizen_id, created_at),
  INDEX idx_complaints_assigned_admin (assigned_admin_id),
  INDEX idx_complaints_status_created (status, created_at),
  INDEX idx_complaints_category (category),
  INDEX idx_complaints_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS complaint_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id BIGINT NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  cnn_category VARCHAR(100),
  cnn_confidence DECIMAL(7, 6),
  vlm_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_images_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint_images_complaint_created (complaint_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS complaint_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id BIGINT NOT NULL,
  admin_id BIGINT NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_status_history_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT fk_complaint_status_history_admin
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_status_history_complaint_created (complaint_id, created_at),
  INDEX idx_status_history_admin_created (admin_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS complaint_progress_updates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id BIGINT NOT NULL,
  admin_id BIGINT NOT NULL,
  stage ENUM(
    'Complaint Received',
    'Investigation',
    'Work in Progress',
    'Verification',
    'Resolved'
  ) NOT NULL,
  progress_percentage TINYINT UNSIGNED NOT NULL,
  remarks TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_progress_updates_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  CONSTRAINT fk_complaint_progress_updates_admin
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_complaint_progress_percentage
    CHECK (progress_percentage BETWEEN 0 AND 100),
  CONSTRAINT chk_complaint_progress_resolved
    CHECK (stage <> 'Resolved' OR progress_percentage = 100),
  INDEX idx_progress_updates_complaint_created (complaint_id, created_at, id),
  INDEX idx_progress_updates_admin_created (admin_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS geocoding_cache (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  latitude_key DECIMAL(10, 7) NOT NULL,
  longitude_key DECIMAL(10, 7) NOT NULL,
  state_name VARCHAR(150) NULL,
  district_name VARCHAR(150) NULL,
  city_name VARCHAR(150) NULL,
  taluk_name VARCHAR(150) NULL,
  village_name VARCHAR(150) NULL,
  gram_panchayat_name VARCHAR(150) NULL,
  ward_name VARCHAR(150) NULL,
  locality_name VARCHAR(150) NULL,
  neighbourhood_name VARCHAR(150) NULL,
  postal_code VARCHAR(20) NULL,
  region_name VARCHAR(150) NULL,
  region_level VARCHAR(30) NULL,
  identification_status VARCHAR(30) NOT NULL DEFAULT 'unidentified',
  source VARCHAR(100) NOT NULL DEFAULT 'nominatim',
  confidence DECIMAL(5, 4) NULL,
  raw_response JSON NULL,
  fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  UNIQUE KEY uq_geocoding_coordinate (latitude_key, longitude_key),
  INDEX idx_geocoding_region (region_level, region_name),
  INDEX idx_geocoding_fetched (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS complaint_geography (
  complaint_id BIGINT NOT NULL PRIMARY KEY,
  latitude_key DECIMAL(10, 7) NULL,
  longitude_key DECIMAL(10, 7) NULL,
  state_name VARCHAR(150) NULL,
  district_name VARCHAR(150) NULL,
  city_name VARCHAR(150) NULL,
  taluk_name VARCHAR(150) NULL,
  village_name VARCHAR(150) NULL,
  gram_panchayat_name VARCHAR(150) NULL,
  ward_name VARCHAR(150) NULL,
  locality_name VARCHAR(150) NULL,
  neighbourhood_name VARCHAR(150) NULL,
  postal_code VARCHAR(20) NULL,
  region_name VARCHAR(150) NULL,
  region_level VARCHAR(30) NULL,
  identification_status VARCHAR(30) NOT NULL DEFAULT 'unidentified',
  source VARCHAR(100) NULL,
  confidence DECIMAL(5, 4) NULL,
  provider_reference VARCHAR(255) NULL,
  identified_at DATETIME NULL,
  raw_response JSON NULL,
  CONSTRAINT fk_complaint_geography_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint_geography_region (region_level, region_name),
  INDEX idx_complaint_geography_district (district_name),
  INDEX idx_complaint_geography_status (identification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_departments_active_name (is_active, department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS officers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  designation VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_officers_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_officers_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_officers_user_active (user_id, is_active),
  INDEX idx_officers_department_active (department_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  document_type VARCHAR(100),
  content_text LONGTEXT,
  uploaded_by BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_knowledge_documents_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_knowledge_documents_type_created (document_type, created_at),
  INDEX idx_knowledge_documents_uploader (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS chat_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_role VARCHAR(20),
  session_id VARCHAR(100),
  message TEXT NOT NULL,
  response LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_history_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_chat_history_user_created (user_id, created_at),
  INDEX idx_chat_history_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reward_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  citizen_id BIGINT NULL,
  complaint_id BIGINT NULL,
  points INT NOT NULL,
  amount DECIMAL(12,2) NULL,
  transaction_type VARCHAR(30) NOT NULL,
  description TEXT,
  earned_at DATETIME NULL,
  eligibility_date DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completion_reward_complaint_id BIGINT
    GENERATED ALWAYS AS (
      CASE
        WHEN transaction_type = 'completion' THEN complaint_id
        ELSE NULL
      END
    ) STORED,
  submission_reward_complaint_id BIGINT
    GENERATED ALWAYS AS (
      CASE
        WHEN transaction_type = 'submission' THEN complaint_id
        ELSE NULL
      END
    ) STORED,
  resolution_reward_complaint_id BIGINT
    GENERATED ALWAYS AS (
      CASE
        WHEN transaction_type IN ('completion', 'resolution') THEN complaint_id
        ELSE NULL
      END
    ) STORED,
  CONSTRAINT fk_reward_transactions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_transactions_citizen
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_transactions_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT,
  UNIQUE INDEX uq_reward_completion_per_complaint (completion_reward_complaint_id),
  UNIQUE INDEX uq_reward_submission_per_complaint (submission_reward_complaint_id),
  UNIQUE INDEX uq_reward_resolution_per_complaint (resolution_reward_complaint_id),
  INDEX idx_reward_transactions_user_created (user_id, created_at),
  INDEX idx_reward_transactions_complaint (complaint_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  points_requested INT NOT NULL,
  status VARCHAR(30) DEFAULT 'Pending',
  admin_id BIGINT NULL,
  admin_remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reward_redemptions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reward_redemptions_admin
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reward_redemptions_user_created (user_id, created_at),
  INDEX idx_reward_redemptions_status_created (status, created_at),
  INDEX idx_reward_redemptions_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL,
  action VARCHAR(150) NOT NULL,
  entity_type VARCHAR(100),
  entity_id BIGINT,
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_user_created (user_id, created_at),
  INDEX idx_audit_logs_entity (entity_type, entity_id),
  INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
