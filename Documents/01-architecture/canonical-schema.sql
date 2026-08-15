-- EVOQ canonical MySQL schema draft
-- This is an architecture baseline, not a production migration.
-- Production migrations must be versioned and reviewed before deployment.

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('PLAYER','ORGANIZER','ADMIN') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE player_profiles (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  unique_player_id VARCHAR(64) NOT NULL UNIQUE,
  mobile VARCHAR(32),
  in_game_name VARCHAR(120),
  game_uid VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_player_profile_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE teams (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_team_owner
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE team_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('OWNER','MEMBER') NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_member (team_id, user_id),
  KEY idx_team_members_user (user_id),
  CONSTRAINT fk_team_member_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_member_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE tournaments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organizer_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  tournament_date DATETIME,
  registration_start_at DATETIME NOT NULL,
  registration_end_at DATETIME NOT NULL,
  max_teams INT UNSIGNED NOT NULL,
  players_per_team INT UNSIGNED NOT NULL,
  entry_type ENUM('FREE','PAID') NOT NULL,
  entry_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_qr_path VARCHAR(500),
  payment_instructions TEXT,
  status ENUM('DRAFT','REGISTRATION_OPEN','REGISTRATION_CLOSED','LIVE','COMPLETED') NOT NULL DEFAULT 'DRAFT',
  completed_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tournaments_organizer_status (organizer_id, status),
  CONSTRAINT fk_tournament_organizer
    FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE TABLE tournament_prizes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uq_tournament_prize_position (tournament_id, position),
  CONSTRAINT fk_prize_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE registrations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  transaction_id VARCHAR(160),
  payment_screenshot_path VARCHAR(500),
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME,
  verified_by BIGINT UNSIGNED,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_registration_tournament_team (tournament_id, team_id),
  KEY idx_reg_tournament_status (tournament_id, status),
  KEY idx_reg_team (team_id),
  CONSTRAINT fk_registration_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_registration_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_registration_verifier
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE rounds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_id BIGINT UNSIGNED NOT NULL,
  round_number INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  status ENUM('NOT_STARTED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  started_at DATETIME,
  completed_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_round_number (tournament_id, round_number),
  KEY idx_round_tournament_status (tournament_id, status),
  CONSTRAINT fk_round_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  round_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  status ENUM('NOT_STARTED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  group_size INT UNSIGNED NOT NULL,
  room_id VARCHAR(160),
  room_password VARCHAR(160),
  started_at DATETIME,
  completed_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_name (round_id, name),
  KEY idx_group_round_status (round_id, status),
  CONSTRAINT fk_group_round
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

CREATE TABLE group_teams (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_team (group_id, team_id),
  KEY idx_group_teams_team (team_id),
  CONSTRAINT fk_group_team_group
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_team_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT
);

CREATE TABLE matches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  match_number INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  status ENUM('SCHEDULED','LIVE','COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_match_number (group_id, match_number),
  KEY idx_match_group_status (group_id, status),
  CONSTRAINT fk_match_group
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE match_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  points DECIMAL(12,2) NOT NULL DEFAULT 0,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  placement INT UNSIGNED,
  result_text TEXT,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_match_result_team (match_id, team_id),
  KEY idx_match_results_team (team_id),
  CONSTRAINT fk_result_match
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_result_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE leaderboard_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  points DECIMAL(12,2) NOT NULL DEFAULT 0,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  rank INT UNSIGNED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_leaderboard_match_team (match_id, team_id),
  KEY idx_leaderboard_team (team_id),
  CONSTRAINT fk_leaderboard_match
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_leaderboard_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT
);

CREATE TABLE qualifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  round_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  source_group_id BIGINT UNSIGNED,
  selected_by BIGINT UNSIGNED NOT NULL,
  selected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_qualification_round_team (round_id, team_id),
  CONSTRAINT fk_qualification_round
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  CONSTRAINT fk_qualification_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
  CONSTRAINT fk_qualification_group
    FOREIGN KEY (source_group_id) REFERENCES groups(id) ON DELETE SET NULL,
  CONSTRAINT fk_qualification_selector
    FOREIGN KEY (selected_by) REFERENCES users(id)
);

CREATE TABLE announcements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_announcement_tournament_created (tournament_id, created_at),
  CONSTRAINT fk_announcement_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcement_creator
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  tournament_id BIGINT UNSIGNED,
  type VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  read_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_user_read (user_id, read_at, created_at),
  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
);

CREATE TABLE chat_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_group_created (group_id, created_at),
  CONSTRAINT fk_chat_group
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE tournament_archives (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_id BIGINT UNSIGNED NOT NULL,
  tournament_name VARCHAR(180) NOT NULL,
  completed_at DATETIME NOT NULL,
  registration_count INT UNSIGNED NOT NULL DEFAULT 0,
  final_leaderboard_json JSON NOT NULL,
  qualified_teams_json JSON NOT NULL,
  winners_json JSON,
  summary_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_archive_tournament (tournament_id),
  CONSTRAINT fk_archive_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);
