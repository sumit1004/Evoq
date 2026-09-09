import { describe, expect, it } from 'vitest';
import { getMigrations, splitSqlStatements } from './migrationRunner.js';

describe('migration runner foundation', () => {
  it('splits the phase migration into executable statements', async () => {
    const migrations = await getMigrations();
    const sql = await (await import('node:fs/promises')).readFile(migrations[0].upPath, 'utf8');
    const statements = splitSqlStatements(sql);

    expect(statements.length).toBe(18);
    expect(statements[0]).toMatch(/^-- EVOQ Phase 02 initial schema/);
    expect(statements.at(-1)).toContain('CREATE TABLE tournament_archives');
  });

  it('requires a matching down migration for every up migration', async () => {
    const migrations = await getMigrations();

    expect(migrations).toHaveLength(14);
    expect(migrations[0].version).toBe('001_initial_schema');
    expect(migrations[0].downPath).toContain('001_initial_schema.down.sql');
    expect(migrations[1].version).toBe('002_match_result_media');
    expect(migrations[1].downPath).toContain('002_match_result_media.down.sql');
    expect(migrations[2].version).toBe('003_archive_cleanup_jobs');
    expect(migrations[2].downPath).toContain('003_archive_cleanup_jobs.down.sql');
    expect(migrations[3].version).toBe('004_payment_architecture');
    expect(migrations[3].downPath).toContain('004_payment_architecture.down.sql');
    expect(migrations[4].version).toBe('005_registration_member_snapshots');
    expect(migrations[4].downPath).toContain('005_registration_member_snapshots.down.sql');
    expect(migrations[5].version).toBe('006_add_tournament_game');
    expect(migrations[5].downPath).toContain('006_add_tournament_game.down.sql');
    expect(migrations[6].version).toBe('007_round_assignment_pipeline');
    expect(migrations[6].downPath).toContain('007_round_assignment_pipeline.down.sql');
    expect(migrations[7].version).toBe('008_match_scheduling_and_rooms');
    expect(migrations[7].downPath).toContain('008_match_scheduling_and_rooms.down.sql');
    expect(migrations[8].version).toBe('009_tournament_scoring_configuration');
    expect(migrations[8].downPath).toContain('009_tournament_scoring_configuration.down.sql');
    expect(migrations[9].version).toBe('010_scout_and_organization_staff_management');
    expect(migrations[9].downPath).toContain('010_scout_and_organization_staff_management.down.sql');
    expect(migrations[10].version).toBe('011_player_profile_and_performance');
    expect(migrations[10].downPath).toContain('011_player_profile_and_performance.down.sql');
    expect(migrations[11].version).toBe('012_direct_messaging_and_organization_profiles');
    expect(migrations[11].downPath).toContain('012_direct_messaging_and_organization_profiles.down.sql');
    expect(migrations[12].version).toBe('013_team_logos_and_practice_enhancements');
    expect(migrations[12].downPath).toContain('013_team_logos_and_practice_enhancements.down.sql');
    expect(migrations[13].version).toBe('014_password_reset_tokens');
    expect(migrations[13].downPath).toContain('014_password_reset_tokens.down.sql');
  });
});
