-- EVOQ Phase 02: Scout & Tournament Staff Management Architecture Migration

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_organizations_owner (owner_id),
  CONSTRAINT fk_organization_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 2. Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('OWNER', 'ORGANIZER', 'SCOUT') NOT NULL DEFAULT 'SCOUT',
  status ENUM('ACTIVE', 'REVOKED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org_member (organization_id, user_id),
  KEY idx_org_members_user (user_id, status),
  CONSTRAINT fk_org_member_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Add organization_id to tournaments if not exists
ALTER TABLE tournaments
  ADD COLUMN organization_id BIGINT UNSIGNED NULL AFTER organizer_id,
  ADD CONSTRAINT fk_tournament_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- 4. Tournament Staff table
CREATE TABLE IF NOT EXISTS tournament_staff (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  tournament_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  all_groups BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tournament_staff_user (tournament_id, user_id),
  KEY idx_staff_user_status (user_id, status),
  KEY idx_staff_org (organization_id),
  CONSTRAINT fk_staff_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- 5. Staff Permissions table
CREATE TABLE IF NOT EXISTS staff_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_staff_id BIGINT UNSIGNED NOT NULL,
  permission_key VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_permission (tournament_staff_id, permission_key),
  KEY idx_staff_perm_key (permission_key),
  CONSTRAINT fk_staff_perm_staff FOREIGN KEY (tournament_staff_id) REFERENCES tournament_staff(id) ON DELETE CASCADE
);

-- 6. Staff Group Assignments table
CREATE TABLE IF NOT EXISTS staff_group_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tournament_staff_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_group (tournament_staff_id, group_id),
  KEY idx_staff_group_group (group_id),
  CONSTRAINT fk_staff_group_staff FOREIGN KEY (tournament_staff_id) REFERENCES tournament_staff(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_group_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);

-- 7. Ensure audit_logs supports organization, tournament, and group context
ALTER TABLE audit_logs
  ADD COLUMN organization_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN tournament_id BIGINT UNSIGNED NULL AFTER organization_id,
  ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER tournament_id,
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER group_id,
  ADD INDEX idx_audit_tournament (tournament_id),
  ADD INDEX idx_audit_org (organization_id),
  ADD INDEX idx_audit_group (group_id);
