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

    expect(migrations).toHaveLength(3);
    expect(migrations[0].version).toBe('001_initial_schema');
    expect(migrations[0].downPath).toContain('001_initial_schema.down.sql');
    expect(migrations[1].version).toBe('002_match_result_media');
    expect(migrations[1].downPath).toContain('002_match_result_media.down.sql');
    expect(migrations[2].version).toBe('003_archive_cleanup_jobs');
    expect(migrations[2].downPath).toContain('003_archive_cleanup_jobs.down.sql');
  });
});
