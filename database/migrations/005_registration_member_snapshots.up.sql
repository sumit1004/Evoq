CREATE TABLE registration_member_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  unique_player_id VARCHAR(64) NOT NULL,
  player_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile VARCHAR(32),
  in_game_name VARCHAR(120),
  game_uid VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_registration_member (registration_id, user_id),
  KEY idx_reg_member_snapshot_user (user_id),
  KEY idx_reg_member_snapshot_unique_id (unique_player_id),
  CONSTRAINT fk_reg_member_snapshot_reg FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_member_snapshot_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Backfill existing registrations
INSERT INTO registration_member_snapshots (registration_id, user_id, unique_player_id, player_name, email, mobile, in_game_name, game_uid)
SELECT 
  r.id AS registration_id,
  u.id AS user_id,
  COALESCE(pp.unique_player_id, CONCAT('EVQ-UNKNOWN-', u.id)) AS unique_player_id,
  u.name AS player_name,
  u.email AS email,
  pp.mobile AS mobile,
  pp.in_game_name AS in_game_name,
  pp.game_uid AS game_uid
FROM registrations r
JOIN team_members tm ON tm.team_id = r.team_id
JOIN users u ON u.id = tm.user_id
LEFT JOIN player_profiles pp ON pp.user_id = u.id
ON DUPLICATE KEY UPDATE registration_id = registration_id;
