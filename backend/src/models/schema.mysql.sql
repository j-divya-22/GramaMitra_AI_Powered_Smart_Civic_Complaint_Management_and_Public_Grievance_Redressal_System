-- Gramamitra MySQL schema
-- Run this script in MySQL Workbench. It creates the database and tables;
-- it does not create the MySQL application user or configure the backend.

CREATE DATABASE IF NOT EXISTS gramamitra_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE gramamitra_db;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  language VARCHAR(10) DEFAULT 'en',
  role ENUM('citizen', 'admin') DEFAULT 'citizen',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  citizen_id CHAR(36) NOT NULL,
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  description TEXT NOT NULL,
  original_complaint TEXT,
  status ENUM('pending', 'assigned', 'in_progress', 'resolved', 'rejected') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_address TEXT,
  incident_date DATETIME,
  evidence_files JSON,
  ai_prediction VARCHAR(255),
  ai_confidence DECIMAL(5, 4),
  llm_generated_text TEXT,
  suggested_corrective_action TEXT,
  assigned_to CHAR(36),
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaints_citizen FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_complaints_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id),
  INDEX idx_complaints_citizen_id (citizen_id),
  INDEX idx_complaints_status (status),
  INDEX idx_complaints_category (category),
  INDEX idx_complaints_created_at (created_at),
  INDEX idx_complaints_reference (reference_number)
);

CREATE TABLE IF NOT EXISTS departments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  office_location TEXT,
  working_hours JSON,
  procedures TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS officers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  department_id CHAR(36),
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  designation VARCHAR(255),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_officers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_officers_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  file_path VARCHAR(500),
  department_id CHAR(36),
  category VARCHAR(100),
  created_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_knowledge_documents_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_knowledge_documents_creator FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_knowledge_documents_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  admin_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36),
  details JSON,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_admin_id (admin_id),
  INDEX idx_audit_logs_created_at (created_at)
);

DELIMITER //

CREATE TRIGGER users_set_id
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END//

CREATE TRIGGER complaints_set_id
BEFORE INSERT ON complaints
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END//

CREATE TRIGGER departments_set_id
BEFORE INSERT ON departments
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END//

CREATE TRIGGER officers_set_id
BEFORE INSERT ON officers
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END//

CREATE TRIGGER knowledge_documents_set_id
BEFORE INSERT ON knowledge_documents
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END//

CREATE TRIGGER audit_logs_set_id
BEFORE INSERT ON audit_logs
FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    SET NEW.id = UUID();
  END IF;
END//

DELIMITER ;
