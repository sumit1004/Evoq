-- EVOQ Phase 02: Add match-level room credentials, scheduling, and instructions
ALTER TABLE matches
  ADD COLUMN room_id VARCHAR(160) NULL AFTER status,
  ADD COLUMN room_password VARCHAR(160) NULL AFTER room_id,
  ADD COLUMN check_in_at DATETIME NULL AFTER scheduled_at,
  ADD COLUMN lobby_open_at DATETIME NULL AFTER check_in_at,
  ADD COLUMN instructions TEXT NULL AFTER completed_at;
