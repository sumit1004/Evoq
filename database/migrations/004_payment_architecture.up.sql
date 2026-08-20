-- Create payment_accounts table
CREATE TABLE payment_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organizer_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_account_id VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  onboarding_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  currency VARCHAR(10) DEFAULT 'INR',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_account_organizer_provider (organizer_id, provider),
  CONSTRAINT fk_payment_account_organizer FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Alter tournaments table to add payment configurations
ALTER TABLE tournaments
  ADD COLUMN payment_method ENUM('MANUAL_UPI', 'ONLINE') NULL,
  ADD COLUMN upi_id VARCHAR(255) NULL,
  ADD COLUMN payment_account_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_tournament_payment_account FOREIGN KEY (payment_account_id) REFERENCES payment_accounts(id) ON DELETE SET NULL;

-- Alter registrations table to expand statuses and track rejection metadata
ALTER TABLE registrations
  MODIFY COLUMN status ENUM('PENDING','VERIFIED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN rejected_at DATETIME NULL,
  ADD COLUMN rejected_by BIGINT UNSIGNED NULL,
  ADD INDEX idx_reg_created_at (created_at),
  ADD CONSTRAINT fk_registration_rejecter FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create payments table
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id BIGINT UNSIGNED NOT NULL,
  tournament_id BIGINT UNSIGNED NOT NULL,
  organizer_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_order_id VARCHAR(255) NULL,
  provider_payment_id VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status ENUM('NOT_REQUIRED', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'AWAITING_PAYMENT',
  payment_method VARCHAR(50) NULL,
  transaction_reference VARCHAR(160) NULL,
  proof_url VARCHAR(500) NULL,
  submitted_at DATETIME NULL,
  captured_at DATETIME NULL,
  failed_at DATETIME NULL,
  refunded_at DATETIME NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_organizer FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_payments_registration (registration_id),
  INDEX idx_payments_tournament (tournament_id),
  INDEX idx_payments_organizer (organizer_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_prov_pay (provider_payment_id),
  INDEX idx_payments_prov_ord (provider_order_id),
  INDEX idx_payments_tx_ref (transaction_reference)
);

-- Create payment_events table for idempotency
CREATE TABLE payment_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_event_provider_event (provider_event_id),
  CONSTRAINT fk_payment_event_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  INDEX idx_payment_events_payment (payment_id)
);

-- Create audit_logs table for verification history
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON NULL,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_audit_actor (actor_id)
);
