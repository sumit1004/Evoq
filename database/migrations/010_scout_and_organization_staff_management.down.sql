-- Rollback EVOQ Phase 02 Scout & Staff Management Migration

ALTER TABLE audit_logs
  DROP COLUMN user_id,
  DROP COLUMN group_id,
  DROP COLUMN tournament_id,
  DROP COLUMN organization_id;

DROP TABLE IF EXISTS staff_group_assignments;
DROP TABLE IF EXISTS staff_permissions;
DROP TABLE IF EXISTS tournament_staff;

ALTER TABLE tournaments
  DROP FOREIGN KEY fk_tournament_organization,
  DROP COLUMN organization_id;

DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
