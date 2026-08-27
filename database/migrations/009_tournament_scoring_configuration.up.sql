-- EVOQ Phase 02: Tournament Point Configuration & Scoring Engine Migration

CREATE TABLE IF NOT EXISTS tournament_scoring_configs (
  tournament_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  scoring_mode ENUM('KILLS_AND_POSITION', 'TOTAL_SCORE') NOT NULL DEFAULT 'KILLS_AND_POSITION',
  kill_points_per_kill DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scoring_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_position_points (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  points DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tournament_position (tournament_id, position),
  KEY idx_pos_tournament (tournament_id),
  CONSTRAINT fk_pos_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

ALTER TABLE match_results
  ADD COLUMN kill_points DECIMAL(12,2) NULL AFTER kills,
  ADD COLUMN position_points DECIMAL(12,2) NULL AFTER placement;
