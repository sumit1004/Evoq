-- EVOQ Phase 02: Rollback Tournament Point Configuration & Scoring Engine Migration

ALTER TABLE match_results
  DROP COLUMN IF EXISTS position_points,
  DROP COLUMN IF EXISTS kill_points;

DROP TABLE IF EXISTS tournament_position_points;
DROP TABLE IF EXISTS tournament_scoring_configs;
