ALTER TABLE qualifications
  DROP KEY idx_qualifications_round_group,
  DROP COLUMN rank_at_qualification;

ALTER TABLE group_teams
  DROP KEY idx_group_teams_group_team;

ALTER TABLE rounds
  DROP COLUMN qualifications_finalized_at,
  DROP COLUMN is_locked,
  DROP COLUMN assignment_status;
