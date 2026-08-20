-- Drop foreign keys and columns on tournaments
ALTER TABLE tournaments
  DROP FOREIGN KEY fk_tournament_payment_account,
  DROP COLUMN payment_method,
  DROP COLUMN upi_id,
  DROP COLUMN payment_account_id;

-- Drop foreign keys, indexes, and columns on registrations, and modify status back
ALTER TABLE registrations
  DROP FOREIGN KEY fk_registration_rejecter,
  DROP INDEX idx_reg_created_at,
  DROP COLUMN rejected_at,
  DROP COLUMN rejected_by,
  MODIFY COLUMN status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING';

-- Drop tables
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS payment_accounts;
