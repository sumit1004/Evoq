-- EVOQ Phase 02: Player Profile & Performance Architecture Migration

-- 1. Extend player_profiles table with esports identity & privacy fields
ALTER TABLE player_profiles
  ADD COLUMN country VARCHAR(100) NULL AFTER game_uid,
  ADD COLUMN city VARCHAR(100) NULL AFTER country,
  ADD COLUMN bio TEXT NULL AFTER city,
  ADD COLUMN avatar_url VARCHAR(500) NULL AFTER bio,
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE AFTER avatar_url,
  ADD COLUMN show_game_uid BOOLEAN NOT NULL DEFAULT FALSE AFTER is_public,
  ADD COLUMN show_team BOOLEAN NOT NULL DEFAULT TRUE AFTER show_game_uid,
  ADD COLUMN show_performance BOOLEAN NOT NULL DEFAULT TRUE AFTER show_team,
  ADD COLUMN show_tournaments BOOLEAN NOT NULL DEFAULT TRUE AFTER show_performance,
  ADD COLUMN show_practice BOOLEAN NOT NULL DEFAULT TRUE AFTER show_tournaments,
  ADD COLUMN show_achievements BOOLEAN NOT NULL DEFAULT TRUE AFTER show_practice;

-- 2. Player Game Profiles table (supports multiple games per player)
CREATE TABLE IF NOT EXISTS player_game_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  game_name VARCHAR(120) NOT NULL,
  in_game_name VARCHAR(120) NOT NULL,
  game_uid VARCHAR(120) NOT NULL,
  primary_role VARCHAR(60) NOT NULL,
  secondary_role VARCHAR(60) NULL,
  started_playing_at DATE NULL,
  current_rank VARCHAR(80) NULL,
  highest_rank VARCHAR(80) NULL,
  region VARCHAR(80) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_player_game (user_id, game_name),
  KEY idx_game_profiles_user (user_id),
  KEY idx_game_profiles_game (game_name),
  CONSTRAINT fk_game_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed initial game profiles from existing player_profiles for Free Fire if in_game_name or game_uid exists
INSERT IGNORE INTO player_game_profiles (user_id, game_name, in_game_name, game_uid, primary_role, is_primary)
SELECT user_id, 'Free Fire', COALESCE(in_game_name, 'Player'), COALESCE(game_uid, CONCAT('FF-', unique_player_id)), 'Flex', TRUE
FROM player_profiles
WHERE in_game_name IS NOT NULL OR game_uid IS NOT NULL;

-- 3. Player Practice Sessions table
CREATE TABLE IF NOT EXISTS player_practice_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  session_date DATE NOT NULL,
  game_name VARCHAR(120) NOT NULL,
  title VARCHAR(180) NOT NULL,
  team_name VARCHAR(120) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_practice_sessions_user_date (user_id, session_date),
  KEY idx_practice_sessions_game (game_name),
  CONSTRAINT fk_practice_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Player Practice Matches table
CREATE TABLE IF NOT EXISTS player_practice_matches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  match_number INT UNSIGNED NOT NULL DEFAULT 1,
  played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  game_name VARCHAR(120) NOT NULL,
  placement INT UNSIGNED NULL,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  assists INT UNSIGNED NOT NULL DEFAULT 0,
  damage INT UNSIGNED NOT NULL DEFAULT 0,
  score DECIMAL(10,2) NOT NULL DEFAULT 0,
  survival_time_seconds INT UNSIGNED NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_practice_matches_user (user_id),
  KEY idx_practice_matches_session (session_id),
  KEY idx_practice_matches_played (played_at),
  CONSTRAINT fk_practice_matches_session FOREIGN KEY (session_id) REFERENCES player_practice_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_practice_matches_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Player Practice Weapons table (optional breakdown)
CREATE TABLE IF NOT EXISTS player_practice_weapons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  practice_match_id BIGINT UNSIGNED NOT NULL,
  weapon_name VARCHAR(80) NOT NULL,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  damage INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_practice_weapons_match (practice_match_id),
  CONSTRAINT fk_practice_weapons_match FOREIGN KEY (practice_match_id) REFERENCES player_practice_matches(id) ON DELETE CASCADE
);
