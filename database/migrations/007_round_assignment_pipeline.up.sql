-- EVOQ Phase 02: Scalable Group Assignment & Multi-round Qualification Pipeline Migration

ALTER TABLE rounds
  ADD COLUMN assignment_status ENUM('DRAFT', 'READY', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN qualifications_finalized_at DATETIME DEFAULT NULL;

ALTER TABLE qualifications
  ADD COLUMN rank_at_qualification INT UNSIGNED DEFAULT NULL;

-- High performance indexing for assignment lookups and qualifications
ALTER TABLE group_teams
  ADD KEY idx_group_teams_group_team (group_id, team_id);

ALTER TABLE qualifications
  ADD KEY idx_qualifications_round_group (round_id, source_group_id);
