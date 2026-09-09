DROP TABLE IF EXISTS player_practice_weapons;
DROP TABLE IF EXISTS player_practice_matches;
DROP TABLE IF EXISTS player_practice_sessions;
DROP TABLE IF EXISTS player_game_profiles;

ALTER TABLE player_profiles
  DROP COLUMN IF EXISTS show_achievements,
  DROP COLUMN IF EXISTS show_practice,
  DROP COLUMN IF EXISTS show_tournaments,
  DROP COLUMN IF EXISTS show_performance,
  DROP COLUMN IF EXISTS show_team,
  DROP COLUMN IF EXISTS show_game_uid,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS country;
