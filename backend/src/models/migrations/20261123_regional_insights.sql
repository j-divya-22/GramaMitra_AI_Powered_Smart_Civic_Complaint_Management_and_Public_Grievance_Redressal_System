-- Additive migration for GramaMitra Regional Insights.
-- Apply manually:
-- mysql -u <user> -p <database> < backend/src/models/migrations/20261123_regional_insights.sql
-- Rollback guidance:
-- DROP TABLE complaint_geography;
-- DROP TABLE geocoding_cache;

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
