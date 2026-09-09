-- EVOQ Migration 013 Down: Rollback Team Logo

ALTER TABLE teams
  DROP COLUMN logo_url;
