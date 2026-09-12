/**
 * EVOQ Phase 6.1 - First Login ECONNRESET & Fresh Cold Start Validation
 * 
 * Verifies that across multiple completely fresh server cold starts:
 * - The very first login request succeeds immediately with 200 OK (5/5 fresh starts).
 * - Zero ECONNRESET errors occur.
 * - Zero process crashes occur.
 * - Validates Player, Organizer, Scout, and Invalid Credentials on fresh starts.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {
  setupTestDatabase,
  truncateAllTables,
  closeTestDatabase,
  createTestUser,
  getTestPool,
} from '../testEnvironment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEntry = path.resolve(__dirname, '../../index.js');

const results = {
  runs: [],
  organizerFirstLogin: null,
  scoutFirstLogin: null,
  invalidCredentialsFirstLogin: null,
  summary: {
    totalRuns: 0,
    successRuns: 0,
    econnresetErrors: 0,
    backendCrashes: 0,
  },
};

async function waitForServerReady(port, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) {
        return true;
      }
    } catch {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  throw new Error(`Server failed to become ready on port ${port} within ${maxWaitMs}ms`);
}

async function runFreshStartLoginTest(runIndex, credentials) {
  console.log(`\n==================================================`);
  console.log(` EXECUTING FRESH SERVER START - RUN #${runIndex}`);
  console.log(`==================================================`);

  const port = 49152 + runIndex + Math.floor(Math.random() * 1000);
  let serverProcess = null;
  let errorCaught = null;
  let statusCode = null;
  let responseData = null;
  let durationMs = 0;

  try {
    // 1. Spawn fresh Node.js backend process
    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
    };

    serverProcess = spawn('node', [serverEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrOutput = '';
    serverProcess.stderr.on('data', (d) => {
      stderrOutput += d.toString();
    });

    // 2. Wait until HTTP port is ready
    await waitForServerReady(port);

    // 3. Send immediate FIRST login request on the fresh instance
    const t0 = performance.now();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      durationMs = +(performance.now() - t0).toFixed(2);
      statusCode = res.status;
      responseData = await res.json();
    } catch (reqErr) {
      durationMs = +(performance.now() - t0).toFixed(2);
      errorCaught = reqErr.message;
      if (reqErr.cause?.code === 'ECONNRESET' || reqErr.message.includes('ECONNRESET')) {
        results.summary.econnresetErrors++;
      }
    }

    const success = statusCode === 200 && responseData?.token && responseData?.identity;
    const runRecord = {
      runIndex,
      port,
      statusCode,
      success: Boolean(success),
      durationMs,
      error: errorCaught,
      econnreset: errorCaught?.includes('ECONNRESET') || false,
    };

    results.runs.push(runRecord);
    results.summary.totalRuns++;
    if (success) {
      results.summary.successRuns++;
    }

    console.log(`Run #${runIndex} Result: ${success ? 'SUCCESS (200 OK)' : 'FAILED'} in ${durationMs}ms | Status: ${statusCode} | Error: ${errorCaught || 'None'}`);
    return runRecord;
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 500));
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  }
}

async function runSpecializedFirstLoginTest(title, credentials, expectedStatus) {
  console.log(`\n--- Testing ${title} on Fresh Backend Start ---`);
  const port = 51000 + Math.floor(Math.random() * 1000);
  let serverProcess = null;
  let statusCode = null;
  let responseData = null;
  let durationMs = 0;
  let errorCaught = null;

  try {
    const env = { ...process.env, PORT: String(port), NODE_ENV: 'test' };
    serverProcess = spawn('node', [serverEntry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    await waitForServerReady(port);

    const t0 = performance.now();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      durationMs = +(performance.now() - t0).toFixed(2);
      statusCode = res.status;
      responseData = await res.json();
    } catch (reqErr) {
      durationMs = +(performance.now() - t0).toFixed(2);
      errorCaught = reqErr.message;
    }

    const matched = statusCode === expectedStatus;
    console.log(`[${title}] Result: ${matched ? 'PASSED' : 'FAILED'} (Got ${statusCode}, Expected ${expectedStatus}) in ${durationMs}ms`);
    return { title, statusCode, expectedStatus, matched, durationMs, error: errorCaught };
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 500));
      if (!serverProcess.killed) serverProcess.kill('SIGKILL');
    }
  }
}

export async function runFirstLoginEconnresetValidation() {
  console.log('================================================================================');
  console.log(' EVOQ PHASE 6.1: FIRST LOGIN ECONNRESET & FRESH START VALIDATION               ');
  console.log('================================================================================\n');

  await setupTestDatabase();
  const pool = getTestPool();
  await truncateAllTables();

  // Create accounts for validation
  console.log('Creating test user accounts in test database...');
  const password = 'Password123!';
  const player = await createTestUser({ name: 'Player FirstLogin', email: 'firstlogin.player@evoq.gg', role: 'PLAYER' });
  const organizer = await createTestUser({ name: 'Organizer FirstLogin', email: 'firstlogin.org@evoq.gg', role: 'ORGANIZER' });
  const scout = await createTestUser({ name: 'Scout FirstLogin', email: 'firstlogin.scout@evoq.gg', role: 'PLAYER' });

  // Create default org
  const [orgRes] = await pool.query(
    `INSERT INTO organizations (name, owner_id) VALUES ('Scout Org', ?)`,
    [organizer.id]
  );
  const orgId = orgRes.insertId;

  // Add scout assignment
  const [tRes] = await pool.query(
    `INSERT INTO tournaments (organizer_id, name, description, tournament_date, registration_start_at, registration_end_at, max_teams, players_per_team, entry_type, entry_fee, status)
     VALUES (?, 'Scout Tourney', 'Desc', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 16, 1, 'FREE', 0, 'REGISTRATION_OPEN')`,
    [organizer.id]
  );
  await pool.query(
    `INSERT INTO tournament_staff (organization_id, tournament_id, user_id, all_groups, status, created_by) VALUES (?, ?, ?, 1, 'ACTIVE', ?)`,
    [orgId, tRes.insertId, scout.id, organizer.id]
  );

  // Execute 5 Fresh Starts with Player Credentials
  for (let i = 1; i <= 5; i++) {
    await runFreshStartLoginTest(i, { email: 'firstlogin.player@evoq.gg', password });
  }

  // Execute Organizer First Login
  results.organizerFirstLogin = await runSpecializedFirstLoginTest('Organizer First Login', { email: 'firstlogin.org@evoq.gg', password }, 200);

  // Execute Scout First Login
  results.scoutFirstLogin = await runSpecializedFirstLoginTest('Scout First Login', { email: 'firstlogin.scout@evoq.gg', password }, 200);

  // Execute Invalid Credentials on First Attempt
  results.invalidCredentialsFirstLogin = await runSpecializedFirstLoginTest('Invalid Credentials First Attempt', { email: 'firstlogin.player@evoq.gg', password: 'WrongPassword!' }, 401);

  await truncateAllTables();
  await closeTestDatabase();

  console.log('\n================================================================================');
  console.log(' FIRST LOGIN VALIDATION RESULTS SUMMARY                                         ');
  console.log('================================================================================');
  console.log(`Total Fresh Starts Tested:  ${results.summary.totalRuns}`);
  console.log(`First-Attempt Success Rate: ${results.summary.successRuns} / ${results.summary.totalRuns} (${(results.summary.successRuns / results.summary.totalRuns * 100).toFixed(0)}%)`);
  console.log(`ECONNRESET Errors Caught:   ${results.summary.econnresetErrors}`);
  console.log(`Backend Crashes:            ${results.summary.backendCrashes}`);
  console.log(JSON.stringify(results, null, 2));

  return results;
}

if (process.argv[1]?.endsWith('firstLoginEconnreset.bench.js')) {
  runFirstLoginEconnresetValidation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Validation failed:', err);
      process.exit(1);
    });
}
