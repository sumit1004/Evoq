-- EVOQ Phase 02: Direct Messaging & Public Organization Profiles Migration

-- 1. Extend organizations table for public profiles and discovery
ALTER TABLE organizations
  ADD COLUMN slug VARCHAR(180) NULL UNIQUE AFTER name,
  ADD COLUMN description VARCHAR(255) NULL AFTER slug,
  ADD COLUMN about TEXT NULL AFTER description,
  ADD COLUMN logo_url VARCHAR(500) NULL AFTER about,
  ADD COLUMN cover_url VARCHAR(500) NULL AFTER logo_url,
  ADD COLUMN country VARCHAR(100) NULL AFTER cover_url,
  ADD COLUMN city VARCHAR(100) NULL AFTER country,
  ADD COLUMN founded_year INT UNSIGNED NULL AFTER city,
  ADD COLUMN website_url VARCHAR(255) NULL AFTER founded_year,
  ADD COLUMN discord_url VARCHAR(255) NULL AFTER website_url,
  ADD COLUMN twitter_url VARCHAR(255) NULL AFTER discord_url,
  ADD COLUMN instagram_url VARCHAR(255) NULL AFTER twitter_url,
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE AFTER instagram_url,
  ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE AFTER is_public,
  ADD INDEX idx_org_public_name (is_public, name);

-- 2. Direct Conversations table
CREATE TABLE IF NOT EXISTS direct_conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('DIRECT', 'ORGANIZATION') NOT NULL DEFAULT 'DIRECT',
  organization_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_conv_type_updated (type, updated_at),
  KEY idx_conv_org (organization_id),
  CONSTRAINT fk_conv_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- 3. Direct Conversation Participants table
CREATE TABLE IF NOT EXISTS direct_conversation_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  last_read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv_participant (conversation_id, user_id),
  KEY idx_conv_part_user (user_id),
  CONSTRAINT fk_part_conv FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_part_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Direct Messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  KEY idx_dm_conv_created (conversation_id, created_at),
  KEY idx_dm_sender (sender_id),
  CONSTRAINT fk_dm_conv FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_dm_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
