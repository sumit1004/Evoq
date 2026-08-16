import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../database/migrations',
);

export function splitSqlStatements(sql) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function getMigrations() {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });
  const migrations = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.up.sql'))
    .map((entry) => {
      const version = entry.name.replace(/\.up\.sql$/, '');
      return {
        version,
        upPath: path.join(migrationsDirectory, entry.name),
        downPath: path.join(migrationsDirectory, `${version}.down.sql`),
      };
    })
    .sort((left, right) => left.version.localeCompare(right.version, undefined, { numeric: true }));

  for (const migration of migrations) {
    try {
      await fs.access(migration.downPath);
    } catch {
      throw new Error(`Missing rollback file for migration ${migration.version}`);
    }
  }

  return migrations;
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function executeMigrationFile(connection, filePath) {
  const sql = await fs.readFile(filePath, 'utf8');
  for (const statement of splitSqlStatements(sql)) {
    await connection.query(statement);
  }
}

export async function runMigrations() {
  const migrations = await getMigrations();
  const connection = await pool.getConnection();

  try {
    await ensureMigrationTable(connection);
    const [appliedRows] = await connection.query(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    const applied = new Set(appliedRows.map((row) => row.version));
    const pending = migrations.filter((migration) => !applied.has(migration.version));

    for (const migration of pending) {
      await connection.beginTransaction();
      try {
        await executeMigrationFile(connection, migration.upPath);
        await connection.query(
          'INSERT INTO schema_migrations (version) VALUES (?)',
          [migration.version],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(`Migration ${migration.version} failed: ${error.message}`, { cause: error });
      }
    }

    return { applied: pending.map((migration) => migration.version) };
  } finally {
    connection.release();
  }
}

export async function rollbackLastMigration() {
  const migrations = await getMigrations();
  const connection = await pool.getConnection();

  try {
    await ensureMigrationTable(connection);
    const [rows] = await connection.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
    );
    const version = rows[0]?.version;

    if (!version) {
      return { rolledBack: null };
    }

    const migration = migrations.find((candidate) => candidate.version === version);
    if (!migration) {
      throw new Error(`Applied migration ${version} has no local migration file`);
    }

    await connection.beginTransaction();
    try {
      await executeMigrationFile(connection, migration.downPath);
      await connection.query('DELETE FROM schema_migrations WHERE version = ?', [version]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw new Error(`Rollback ${version} failed: ${error.message}`, { cause: error });
    }

    return { rolledBack: version };
  } finally {
    connection.release();
  }
}
