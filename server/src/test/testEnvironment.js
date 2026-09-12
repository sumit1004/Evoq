import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { pool } from '../config/database.js';
import { invalidateUserTokenVersion, setUserTokenVersion } from '../services/identityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.resolve(__dirname, '../../../database/migrations');

export const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || config.db.host || 'localhost',
  port: Number(process.env.TEST_DB_PORT) || config.db.port || 3306,
  user: process.env.TEST_DB_USER || config.db.user || 'evoq',
  password: process.env.TEST_DB_PASSWORD || config.db.password || 'Sumit@10042006',
  database: process.env.TEST_DB_NAME || 'evoq_test',
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 15,
};

// Safety Check: Never allow test operations on production databases
export function assertSafeTestDatabase(dbName = TEST_DB_CONFIG.database) {
  if (dbName === 'evoq' || dbName === 'production' || !dbName.toLowerCase().includes('test')) {
    throw new Error(`SAFETY ERROR: Refusing to run destructive test operations on database '${dbName}'! Test DB must contain 'test'.`);
  }
}

export function getTestPool() {
  assertSafeTestDatabase(TEST_DB_CONFIG.database);
  return pool;
}

let databaseInitialized = false;

export async function setupTestDatabase() {
  assertSafeTestDatabase(TEST_DB_CONFIG.database);
  if (databaseInitialized) {
    return getTestPool();
  }
  const adminConn = await mysql.createConnection({
    host: TEST_DB_CONFIG.host,
    port: TEST_DB_CONFIG.port,
    user: TEST_DB_CONFIG.user,
    password: TEST_DB_CONFIG.password,
    multipleStatements: true,
  });

  try {
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB_CONFIG.database}\``);
    await adminConn.query(`USE \`${TEST_DB_CONFIG.database}\``);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const entries = await fs.readdir(migrationsDirectory);
    const upMigrations = entries.filter((f) => f.endsWith('.up.sql')).sort();

    const [appliedRows] = await adminConn.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map((r) => r.version));

    for (const migrationFile of upMigrations) {
      const version = migrationFile.replace(/\.up\.sql$/, '');
      if (!appliedSet.has(version)) {
        const sql = await fs.readFile(path.join(migrationsDirectory, migrationFile), 'utf8');
        try {
          await adminConn.query(sql);
        } catch (err) {
          if (
            err.code !== 'ER_TABLE_EXISTS_ERROR' &&
            err.code !== 'ER_DUP_FIELDNAME' &&
            err.code !== 'ER_CANT_DROP_FIELD_OR_KEY' &&
            err.code !== 'ER_DUP_KEYNAME'
          ) {
            throw err;
          }
        }
        await adminConn.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [version]);
      }
    }
    databaseInitialized = true;
  } finally {
    await adminConn.end();
  }

  return getTestPool();
}

const ALL_APPLICATION_TABLES = [
  'tournament_archives',
  'archive_cleanup_jobs',
  'audit_logs',
  'payment_events',
  'payments',
  'payment_accounts',
  'direct_messages',
  'direct_conversation_participants',
  'direct_conversations',
  'chat_messages',
  'notifications',
  'announcements',
  'qualifications',
  'leaderboard_entries',
  'match_results',
  'matches',
  'group_teams',
  'staff_group_assignments',
  'staff_permissions',
  'tournament_staff',
  'tournament_position_points',
  'tournament_scoring_configs',
  'tournament_prizes',
  'registration_member_snapshots',
  'registrations',
  'groups',
  'rounds',
  'tournaments',
  'organization_members',
  'organizations',
  'team_members',
  'teams',
  'player_practice_weapons',
  'player_practice_matches',
  'player_practice_sessions',
  'player_game_profiles',
  'player_profiles',
  'users',
];

export async function truncateAllTables() {
  assertSafeTestDatabase();
  const pool = getTestPool();
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ALL_APPLICATION_TABLES) {
      await connection.query(`DELETE FROM \`${table}\``);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }
}

export async function closeTestDatabase() {
  // Keep singleton module pool active across sequential test files
}

export const closeTestPool = closeTestDatabase;

// ----------------------------------------------------
// Fixture Factories for Integration Tests
// ----------------------------------------------------

export async function createTestUser({
  name = 'Test User',
  email = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`,
  password = 'Password123!',
  role = 'PLAYER',
  tokenVersion = 1,
} = {}) {
  const pool = getTestPool();
  const passwordHash = await bcrypt.hash(password, 4); // Fast hash for tests

  const [res] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, token_version) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, role, tokenVersion]
  );
  const userId = res.insertId;

  let uniquePlayerId = null;
  if (role === 'PLAYER') {
    uniquePlayerId = `EVQ-${userId.toString().padStart(4, '0')}`;
    await pool.query(
      'INSERT INTO player_profiles (user_id, unique_player_id, mobile, in_game_name, game_uid) VALUES (?, ?, ?, ?, ?)',
      [userId, uniquePlayerId, '9876543210', name, `UID_${userId}`]
    );
  }

  const token = jwt.sign({ role, tokenVersion }, config.jwtSecret, {
    subject: String(userId),
    expiresIn: '24h',
  });

  const userObj = { id: userId, name, email, role, tokenVersion, uniquePlayerId };
  return { id: userId, name, email, role, tokenVersion, uniquePlayerId, user: userObj, token, password };
}

export async function createTestTeam(ownerId, { name = `Team_${Date.now()}` } = {}) {
  const pool = getTestPool();
  const [teamRes] = await pool.query(
    'INSERT INTO teams (name, owner_id) VALUES (?, ?)',
    [name, ownerId]
  );
  const teamId = teamRes.insertId;

  await pool.query(
    'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
    [teamId, ownerId, 'OWNER']
  );

  return { id: teamId, name, ownerId };
}

export async function addTeamMember(teamId, userId, role = 'MEMBER') {
  const pool = getTestPool();
  await pool.query(
    'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
    [teamId, userId, role]
  );
}

export async function createTestTournament(organizerId, {
  name = `Tournament_${Date.now()}`,
  status = 'DRAFT',
  maxTeams = 16,
  entryType = 'FREE',
  entryFee = 0,
} = {}) {
  const pool = getTestPool();
  const now = new Date();
  const end = new Date(Date.now() + 7 * 86400000);

  const [res] = await pool.query(
    `INSERT INTO tournaments 
     (organizer_id, name, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [organizerId, name, now, end, maxTeams, 4, entryType, entryFee, status]
  );
  return { id: res.insertId, organizerId, name, status, maxTeams, entryType, entryFee };
}
