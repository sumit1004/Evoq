-- EVOQ Phase 02: Rollback Password Reset Tokens Migration

DROP TABLE IF EXISTS password_reset_tokens;

ALTER TABLE users DROP COLUMN token_version;
