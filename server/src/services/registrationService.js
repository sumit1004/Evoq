import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import { pool } from '../config/database.js';
import {
  countRegistrations,
  findPlayerRegistration,
  findRegistration,
  findRegistrationFile,
  getRegistrationContext,
  insertRegistration,
  listPlayerRegistrations,
  listRegistrations,
  reviewRegistration,
  getTournamentRegistrationCountForUpdate,
  listTeamMembersWithProfiles,
  insertRegistrationMemberSnapshots
} from '../repositories/registrationRepository.js';
import { findTournament, findTournamentForUpdate } from '../repositories/tournamentRepository.js';
import * as paymentRepo from '../repositories/paymentRepository.js';
import { createPayment } from './paymentService.js';
import { emitRealtime, realtimeRooms } from '../utils/realtimeHub.js';

function groupRows(rows) {
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: first.id,
    tournamentId: first.tournament_id,
    tournamentName: first.tournament_name,
    teamId: first.team_id,
    teamName: first.team_name,
    status: first.status,
    entryType: first.entry_type,
    submittedAt: first.submitted_at,
    verifiedAt: first.verified_at,
    verifiedBy: first.verified_by,
    rejectionReason: first.rejection_reason,
    rejectedAt: first.rejected_at,
    rejectedBy: first.rejected_by,
    organizerId: first.organizer_id,
    tournamentStatus: first.tournament_status,
    // Payment details
    paymentStatus: first.payment_status || 'NOT_REQUIRED',
    paymentAmount: first.payment_amount,
    transactionId: first.transaction_reference,
    paymentScreenshotPath: first.proof_url,
    paymentProvider: first.payment_provider,
    paymentOrderId: first.provider_order_id,
    paymentId: first.provider_payment_id,
    paymentCurrency: first.payment_currency,
    paymentCapturedAt: first.payment_captured_at,
    members: rows.map((row) => ({
      id: row.member_id,
      name: row.member_name,
      email: row.member_email,
      uniquePlayerId: row.unique_player_id,
      mobile: row.member_mobile,
      ign: row.member_ign,
      uid: row.member_uid,
    })),
  };
}

export async function listTournamentRegistrations(tournamentId, organizerId) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) {
    throw errorResponses.notFound('Tournament not found');
  }
  const grouped = new Map();
  for (const row of await listRegistrations(tournamentId)) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        tournamentId: row.tournament_id,
        tournamentName: row.tournament_name,
        teamId: row.team_id,
        teamName: row.team_name,
        status: row.status,
        entryType: row.entry_type,
        submittedAt: row.submitted_at,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by,
        rejectionReason: row.rejection_reason,
        rejectedAt: row.rejected_at,
        rejectedBy: row.rejected_by,
        organizerId: row.organizer_id,
        tournamentStatus: row.tournament_status,
        paymentStatus: row.payment_status || 'NOT_REQUIRED',
        paymentAmount: row.payment_amount,
        transactionId: row.transaction_reference,
        paymentScreenshotPath: row.proof_url,
        paymentProvider: row.payment_provider,
        paymentOrderId: row.provider_order_id,
        paymentId: row.provider_payment_id,
        paymentCurrency: row.payment_currency,
        paymentCapturedAt: row.payment_captured_at,
        members: [],
      });
    }
    grouped.get(row.id).members.push({
      id: row.member_id,
      name: row.member_name,
      email: row.member_email,
      uniquePlayerId: row.unique_player_id,
      mobile: row.member_mobile,
      ign: row.member_ign,
      uid: row.member_uid,
    });
  }
  return Array.from(grouped.values());
}

export async function listTournamentRegistrationsPage(tournamentId, organizerId, options = {}) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) {
    throw errorResponses.notFound('Tournament not found');
  }
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const filters = { status: options.status, search: options.search };
  const [rows, total] = await Promise.all([
    listRegistrations(tournamentId, { ...filters, pagination: { limit, offset: (page - 1) * limit } }),
    countRegistrations(tournamentId, filters),
  ]);
  const grouped = new Map();
  for (const row of rows) {
    grouped.set(row.id, [...(grouped.get(row.id) || []), row]);
  }
  return {
    registrations: [...grouped.values()].map(groupRows),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function listPlayerTournamentRegistrations(tournamentId, userId) {
  const grouped = new Map();
  for (const row of await listPlayerRegistrations(tournamentId, userId)) {
    grouped.set(row.id, [...(grouped.get(row.id) || []), row]);
  }
  return [...grouped.values()].map((rows) => {
    const item = groupRows(rows);
    delete item.paymentScreenshotPath;
    item.members = item.members.map(({ email: _email, mobile: _mobile, ...member }) => member);
    return item;
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportTournamentRegistrations(tournamentId, organizerId) {
  const registrations = await listTournamentRegistrations(tournamentId, organizerId);
  const header = ['registration_id', 'status', 'team_name', 'member_name', 'member_email', 'unique_player_id', 'member_mobile', 'in_game_name', 'game_uid', 'game', 'transaction_id', 'submitted_at', 'rejection_reason'];
  const lines = [header.map(csvCell).join(',')];
  for (const registration of registrations) {
    for (const member of registration.members) {
      lines.push(
        [
          registration.id,
          registration.status,
          registration.teamName,
          member.name,
          member.email,
          member.uniquePlayerId,
          member.mobile,
          member.ign,
          member.uid,
          registration.tournamentGame || 'Free Fire',
          registration.transactionId,
          registration.submittedAt,
          registration.rejectionReason,
        ]
          .map(csvCell)
          .join(','),
      );
    }
  }
  return lines.join('\r\n');
}

export async function buildTournamentRegistrationWorkbook(tournamentId, organizerId) {
  const ExcelJS = (await import('exceljs')).default;
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) {
    throw errorResponses.notFound('Tournament not found');
  }
  const registrations = await listTournamentRegistrations(tournamentId, organizerId);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Registrations');
  sheet.columns = [
    { header: 'Tournament Name', key: 'tournamentName', width: 24 },
    { header: 'Tournament Game', key: 'tournamentGame', width: 18 },
    { header: 'Tournament Date', key: 'tournamentDate', width: 20 },
    { header: 'Registration Date', key: 'submittedAt', width: 22 },
    { header: 'Registration Status', key: 'status', width: 18 },
    { header: 'Team Name', key: 'teamName', width: 24 },
    { header: 'Team ID', key: 'teamId', width: 14 },
    { header: 'Member Name', key: 'memberName', width: 24 },
    { header: 'Member Unique ID', key: 'uniquePlayerId', width: 20 },
    { header: 'Member Email', key: 'memberEmail', width: 30 },
    { header: 'Member Mobile', key: 'memberMobile', width: 18 },
    { header: 'In-Game Name', key: 'inGameName', width: 20 },
    { header: 'Game UID', key: 'gameUid', width: 20 },
    { header: 'Game', key: 'game', width: 18 },
    { header: 'Entry Type', key: 'entryType', width: 14 },
    { header: 'Entry Fee', key: 'entryFee', width: 14 },
    { header: 'Transaction ID', key: 'transactionId', width: 24 },
    { header: 'Payment Status', key: 'paymentStatus', width: 18 },
  ];
  for (const registration of registrations) {
    for (const member of registration.members) {
      sheet.addRow({
        tournamentName: registration.tournamentName,
        tournamentGame: tournament.game,
        tournamentDate: tournament.tournament_date,
        submittedAt: registration.submittedAt,
        status: registration.status,
        teamName: registration.teamName,
        teamId: registration.teamId,
        memberName: member.name,
        uniquePlayerId: member.uniquePlayerId,
        memberEmail: member.email,
        memberMobile: member.mobile,
        inGameName: member.ign,
        gameUid: member.uid,
        game: tournament.game,
        entryType: registration.entryType,
        entryFee: tournament.entry_fee,
        transactionId: registration.transactionId,
        paymentStatus: registration.paymentStatus,
      });
    }
  }
  sheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

export async function getRegistrationForPlayer(registrationId, userId) {
  const registration = groupRows(await findPlayerRegistration(registrationId, userId));
  if (!registration) {
    throw errorResponses.notFound('Registration not found');
  }
  delete registration.paymentScreenshotPath;
  registration.members = registration.members.map(({ email: _email, mobile: _mobile, ...member }) => member);
  return registration;
}

export async function getRegistrationForOrganizer(registrationId, organizerId) {
  const registration = groupRows(await findRegistration(registrationId));
  if (!registration || registration.organizerId !== organizerId) {
    throw errorResponses.notFound('Registration not found');
  }
  return registration;
}

export async function createPlayerRegistration(tournamentId, input, userId, uploadedFile) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock tournament row for updates to avoid race conditions
    const tournament = await findTournamentForUpdate(tournamentId, connection);
    if (!tournament) {
      throw errorResponses.notFound('Tournament not found');
    }

    const context = await getRegistrationContext(tournamentId, input.teamId, connection);
    if (!context) {
      throw errorResponses.notFound('Tournament or team not found');
    }
    if (context.owner_id !== userId) {
      throw errorResponses.forbidden();
    }
    if (context.tournament_status !== 'REGISTRATION_OPEN') {
      throw errorResponses.conflict('Registration is not open for this tournament');
    }
    if (Number(context.member_count) !== Number(context.players_per_team)) {
      throw errorResponses.validation({ teamId: 'Team size does not match this tournament' });
    }

    // Retrieve members and their profiles to perform data checks
    const members = await listTeamMembersWithProfiles(input.teamId, connection);

    // Validate common and game-specific required fields
    for (const member of members) {
      if (!member.player_name || !member.email || !member.unique_player_id) {
        throw errorResponses.validation({ teamId: 'Player account profile is incomplete' });
      }
      if (!member.mobile) {
        throw errorResponses.validation({ teamId: `Player ${member.player_name}'s Mobile Number is missing. Ask the player to complete their profile before registering the team.` });
      }
      if (tournament.game === 'Free Fire') {
        if (!member.in_game_name) {
          throw errorResponses.validation({ teamId: `Player ${member.player_name}'s In-Game Name is missing. Ask the player to complete their profile before registering the team.` });
        }
        if (!member.game_uid) {
          throw errorResponses.validation({ teamId: `Player ${member.player_name}'s Free Fire UID is missing. Ask the player to complete their profile before registering the team.` });
        }
      }
    }

    // Capacity Check
    const activeCount = await getTournamentRegistrationCountForUpdate(tournamentId, connection);
    if (activeCount >= tournament.max_teams) {
      throw errorResponses.conflict('Tournament capacity has been reached');
    }

    // Payment validation
    if (tournament.entry_type === 'PAID') {
      if (!uploadedFile || !input.transactionId?.trim()) {
        throw errorResponses.validation({ payment: 'Paid registration requires a transaction ID and payment screenshot' });
      }

      // Check duplicate transaction ID
      const duplicate = await paymentRepo.findPaymentByTxRef(input.transactionId.trim(), tournamentId);
      if (duplicate) {
        throw errorResponses.conflict('Possible duplicate transaction');
      }
    }

    // Insert Registration
    const id = await insertRegistration({ tournamentId, teamId: input.teamId }, connection);

    // Create Member Snapshots
    await insertRegistrationMemberSnapshots(id, members, connection);

    // Create Payment Record (Server-side entry fee)
    await createPayment(id, tournament, tournament.organizer_id, input, uploadedFile ? path.basename(uploadedFile.path) : null, connection);

    // Audit Log
    await paymentRepo.insertAuditLog({
      actorId: userId,
      action: 'REGISTRATION_CREATED',
      entityType: 'REGISTRATION',
      entityId: id,
      metadata: { teamId: input.teamId, tournamentId },
    }, connection);

    await connection.commit();

    const createdRegistration = await getRegistrationForPlayer(id, userId);

    // Socket Emits
    const fullReg = groupRows(await findRegistration(id));
    emitRealtime(realtimeRooms.user(tournament.organizer_id), 'registration_created', fullReg);
    emitRealtime(realtimeRooms.tournament(tournamentId), 'registration_created', {
      id: createdRegistration.id,
      status: createdRegistration.status,
      teamName: createdRegistration.teamName,
    });

    return createdRegistration;
  } catch (error) {
    await connection.rollback();
    if (uploadedFile) {
      await fs.unlink(uploadedFile.path).catch(() => {});
    }
    if (error.code === 'ER_DUP_ENTRY') {
      throw errorResponses.conflict('This team is already registered for the tournament');
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function reviewTournamentRegistration(registrationId, input, organizerId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const rows = await findRegistration(registrationId, connection);
    const registration = groupRows(rows);
    if (!registration || registration.organizerId !== organizerId) {
      throw errorResponses.notFound('Registration not found');
    }
    if (registration.status !== 'PENDING') {
      throw errorResponses.conflict('Registration already processed');
    }

    if (input.status === 'VERIFIED') {
      // Re-verify capacity under lock
      const count = await getTournamentRegistrationCountForUpdate(registration.tournamentId, connection);
      const tournament = await findTournament(registration.tournamentId);
      if (count >= tournament.max_teams) {
        throw errorResponses.conflict('Tournament capacity has been reached');
      }

      if (registration.entryType === 'PAID' && !registration.paymentScreenshotPath) {
        throw errorResponses.conflict('Paid registration requires payment evidence');
      }

      // Update payment to VERIFIED/PAID
      const payment = await paymentRepo.findPaymentByRegistrationId(registrationId);
      if (payment) {
        await paymentRepo.updatePayment(payment.id, {
          status: 'VERIFIED',
          capturedAt: new Date(),
        }, connection);
      }
    } else if (input.status === 'REJECTED') {
      const payment = await paymentRepo.findPaymentByRegistrationId(registrationId);
      if (payment) {
        await paymentRepo.updatePayment(payment.id, {
          status: 'REJECTED',
          failureReason: input.rejectionReason,
        }, connection);
      }
    }

    const affected = await reviewRegistration(registrationId, { ...input, verifierId: organizerId }, connection);
    if (!affected) {
      throw errorResponses.conflict('Registration was already reviewed');
    }

    // Audit Log
    await paymentRepo.insertAuditLog({
      actorId: organizerId,
      action: input.status === 'VERIFIED' ? 'REGISTRATION_VERIFIED' : 'REGISTRATION_REJECTED',
      entityType: 'REGISTRATION',
      entityId: registrationId,
      metadata: { reason: input.rejectionReason },
    }, connection);

    await connection.commit();

    const updated = groupRows(await findRegistration(registrationId));

    // Socket events
    emitRealtime(realtimeRooms.user(organizerId), 'registration_updated', updated);
    emitRealtime(realtimeRooms.tournament(registration.tournamentId), input.status === 'VERIFIED' ? 'registration_verified' : 'registration_rejected', {
      id: updated.id,
      status: updated.status,
      teamName: updated.teamName,
    });

    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function precheckBulkVerification(registrationIds, organizerId) {
  const results = [];
  for (const registrationId of registrationIds) {
    try {
      const rows = await findRegistration(registrationId);
      const registration = groupRows(rows);
      if (!registration || registration.organizerId !== organizerId) {
        results.push({ id: registrationId, check: 'Invalid', reason: 'Registration not found' });
        continue;
      }
      if (registration.status !== 'PENDING') {
        results.push({ id: registrationId, check: 'Invalid', reason: 'Registration already processed' });
        continue;
      }
      if (registration.tournamentStatus === 'COMPLETED') {
        results.push({ id: registrationId, check: 'Invalid', reason: 'Completed tournaments are read-only' });
        continue;
      }
      if (registration.entryType === 'PAID') {
        if (!registration.paymentScreenshotPath) {
          results.push({ id: registrationId, check: 'Needs Review', reason: 'Manual payment proof missing' });
          continue;
        }
        if (!registration.transactionId) {
          results.push({ id: registrationId, check: 'Needs Review', reason: 'Transaction reference missing' });
          continue;
        }
        
        // Amount mismatch check: check if the actual paid amount is different (if tracked, fallback)
        if (registration.paymentAmount !== undefined && Number(registration.paymentAmount) <= 0) {
          results.push({ id: registrationId, check: 'Needs Review', reason: 'PAYMENT AMOUNT MISMATCH' });
          continue;
        }
      }
      results.push({ id: registrationId, check: 'Eligible', reason: 'Verification ready' });
    } catch (e) {
      results.push({ id: registrationId, check: 'Invalid', reason: e.message });
    }
  }
  return results;
}

export async function bulkVerifyRegistrations(registrationIds, organizerId) {
  const prechecks = await precheckBulkVerification(registrationIds, organizerId);
  const eligible = prechecks.filter(p => p.check === 'Eligible').map(p => p.id);
  const failed = prechecks.filter(p => p.check !== 'Eligible');

  const successes = [];
  const errors = [];

  for (const regId of eligible) {
    try {
      await reviewTournamentRegistration(regId, { status: 'VERIFIED' }, organizerId);
      successes.push(regId);
    } catch (error) {
      errors.push({ id: regId, reason: error.message });
    }
  }

  return {
    verifiedCount: successes.length,
    verifiedIds: successes,
    failures: [
      ...failed.map(f => ({ id: f.id, reason: f.reason })),
      ...errors,
    ],
  };
}

export async function bulkRejectRegistrations(registrationIds, rejectionReason, organizerId) {
  const successes = [];
  const errors = [];

  for (const regId of registrationIds) {
    try {
      await reviewTournamentRegistration(regId, { status: 'REJECTED', rejectionReason }, organizerId);
      successes.push(regId);
    } catch (error) {
      errors.push({ id: regId, reason: error.message });
    }
  }

  return {
    rejectedCount: successes.length,
    rejectedIds: successes,
    failures: errors,
  };
}

export async function getRegistrationFile(registrationId, userId) {
  const file = await findRegistrationFile(registrationId);
  if (!file) {
    throw errorResponses.notFound('Payment evidence not found');
  }

  // Restrict access to authorized organizer or player of team members
  const isOrganizer = file.organizer_id === userId;
  let isParticipant = false;

  if (!isOrganizer) {
    const registrationDetails = groupRows(await findRegistration(registrationId));
    if (registrationDetails) {
      isParticipant = registrationDetails.members.some(member => member.id === userId);
    }
  }

  if (!isOrganizer && !isParticipant) {
    throw errorResponses.forbidden();
  }

  if (!file.payment_screenshot_path) {
    throw errorResponses.notFound('Payment evidence file not found');
  }

  return path.resolve(config.uploadDirectory, 'payment-evidence', path.basename(file.payment_screenshot_path));
}
