-- EVOQ Migration 013: Team Logo and Practice Performance Enhancements

-- 1. Add logo_url to teams table
ALTER TABLE teams
  ADD COLUMN logo_url VARCHAR(500) NULL AFTER name;
