-- Rollback EVOQ Phase 02: Direct Messaging & Public Organization Profiles

DROP TABLE IF EXISTS direct_messages;
DROP TABLE IF EXISTS direct_conversation_participants;
DROP TABLE IF EXISTS direct_conversations;

ALTER TABLE organizations
  DROP INDEX IF EXISTS idx_org_public_name,
  DROP COLUMN IF EXISTS verified,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS instagram_url,
  DROP COLUMN IF EXISTS twitter_url,
  DROP COLUMN IF EXISTS discord_url,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS founded_year,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS cover_url,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS about,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS slug;
