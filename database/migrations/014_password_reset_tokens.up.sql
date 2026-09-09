-- EVOQ Phase 02: Password Reset Tokens Architecture Migration

-- 1. Add token_version to users table for session revocation upon password change
ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER password_hash;

-- 2. Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_password_reset_user (user_id),
  KEY idx_password_reset_token (token_hash),
  KEY idx_password_reset_expires (expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
