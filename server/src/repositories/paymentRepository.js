import { pool } from '../config/database.js';

export async function findPaymentAccount(organizerId, provider) {
  const [rows] = await pool.query(
    'SELECT id, organizer_id, provider, provider_account_id, status, onboarding_status, currency, created_at FROM payment_accounts WHERE organizer_id = ? AND provider = ? LIMIT 1',
    [organizerId, provider],
  );
  return rows[0] || null;
}

export async function getPaymentAccountById(id) {
  const [rows] = await pool.query(
    'SELECT id, organizer_id, provider, provider_account_id, status, onboarding_status, currency FROM payment_accounts WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

export async function getOrganizerPaymentAccounts(organizerId) {
  const [rows] = await pool.query(
    'SELECT id, organizer_id, provider, provider_account_id, status, onboarding_status, currency FROM payment_accounts WHERE organizer_id = ?',
    [organizerId],
  );
  return rows;
}

export async function upsertPaymentAccount(organizerId, input) {
  const [result] = await pool.query(
    `INSERT INTO payment_accounts (organizer_id, provider, provider_account_id, status, onboarding_status, currency)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE provider_account_id = VALUES(provider_account_id), status = VALUES(status), onboarding_status = VALUES(onboarding_status), currency = VALUES(currency)`,
    [
      organizerId,
      input.provider,
      input.providerAccountId || null,
      input.status || 'ACTIVE',
      input.onboardingStatus || 'COMPLETED',
      input.currency || 'INR',
    ],
  );
  return result.insertId;
}

export async function deletePaymentAccount(organizerId, provider) {
  const [result] = await pool.query(
    'DELETE FROM payment_accounts WHERE organizer_id = ? AND provider = ?',
    [organizerId, provider],
  );
  return result.affectedRows > 0;
}

export async function findPaymentByTxRef(transactionReference, tournamentId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.registration_id, p.tournament_id, p.status, p.amount, p.transaction_reference, r.status AS registration_status, t.name AS team_name
     FROM payments p
     INNER JOIN registrations r ON r.id = p.registration_id
     INNER JOIN teams t ON t.id = r.team_id
     WHERE p.transaction_reference = ? AND p.tournament_id = ? AND p.status NOT IN ('FAILED', 'REFUNDED') LIMIT 1`,
    [transactionReference, tournamentId],
  );
  return rows[0] || null;
}

export async function insertPayment(input, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO payments (registration_id, tournament_id, organizer_id, provider, provider_order_id, provider_payment_id, amount, currency, status, payment_method, transaction_reference, proof_url, submitted_at, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.registrationId,
      input.tournamentId,
      input.organizerId,
      input.provider,
      input.providerOrderId || null,
      input.providerPaymentId || null,
      input.amount,
      input.currency || 'INR',
      input.status || 'AWAITING_PAYMENT',
      input.paymentMethod || null,
      input.transactionReference || null,
      input.proofUrl || null,
      input.submittedAt || null,
      input.capturedAt || null,
    ],
  );
  return result.insertId;
}

export async function findPaymentByRegistrationId(registrationId) {
  const [rows] = await pool.query(
    'SELECT id, registration_id, tournament_id, organizer_id, provider, provider_order_id, provider_payment_id, amount, currency, status, payment_method, transaction_reference, proof_url, submitted_at, captured_at, refunded_at, failure_reason FROM payments WHERE registration_id = ? LIMIT 1',
    [registrationId],
  );
  return rows[0] || null;
}

export async function updatePayment(paymentId, input, connection = pool) {
  const columns = [];
  const values = [];
  const allowed = {
    status: 'status',
    providerPaymentId: 'provider_payment_id',
    capturedAt: 'captured_at',
    failedAt: 'failed_at',
    refundedAt: 'refunded_at',
    failureReason: 'failure_reason',
    proofUrl: 'proof_url',
    transactionReference: 'transaction_reference',
    submittedAt: 'submitted_at',
  };

  for (const [key, column] of Object.entries(allowed)) {
    if (input[key] !== undefined) {
      columns.push(`${column} = ?`);
      values.push(input[key]);
    }
  }

  if (!columns.length) return 0;
  values.push(paymentId);

  const [result] = await connection.query(
    `UPDATE payments SET ${columns.join(', ')} WHERE id = ?`,
    values,
  );
  return result.affectedRows;
}

export async function getPaymentSummary(tournamentId) {
  const [rows] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'PAID' OR status = 'VERIFIED' THEN amount ELSE 0 END), 0) AS collected,
       COALESCE(SUM(CASE WHEN status = 'PAYMENT_SUBMITTED' OR status = 'PENDING_REVIEW' THEN amount ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'FAILED' THEN amount ELSE 0 END), 0) AS failed,
       COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount ELSE 0 END), 0) AS refunded
     FROM payments
     WHERE tournament_id = ?`,
    [tournamentId],
  );
  return {
    collected: Number(rows[0].collected),
    pending: Number(rows[0].pending),
    failed: Number(rows[0].failed),
    refunded: Number(rows[0].refunded),
  };
}

export async function insertPaymentEvent(input, connection = pool) {
  const [result] = await connection.query(
    'INSERT INTO payment_events (payment_id, provider_event_id, event_type, payload) VALUES (?, ?, ?, ?)',
    [
      input.paymentId || null,
      input.providerEventId,
      input.eventType,
      JSON.stringify(input.payload),
    ],
  );
  return result.insertId;
}

export async function findPaymentEvent(providerEventId) {
  const [rows] = await pool.query(
    'SELECT id, payment_id, provider_event_id, event_type, payload, processed_at FROM payment_events WHERE provider_event_id = ? LIMIT 1',
    [providerEventId],
  );
  return rows[0] || null;
}

export async function insertAuditLog(input, connection = pool) {
  const [result] = await connection.query(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)',
    [
      input.actorId,
      input.action,
      input.entityType,
      input.entityId,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
  return result.insertId;
}
