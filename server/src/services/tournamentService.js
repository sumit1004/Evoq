import { errorResponses } from '../errors/AppError.js';
import { createTournament, deleteTournament as repoDeleteTournament, findTournament, listPrizes, listTournaments, updateTournament } from '../repositories/tournamentRepository.js';
import * as paymentRepo from '../repositories/paymentRepository.js';
import path from 'node:path';
import { config } from '../config/env.js';
import { emitRealtime, realtimeRooms } from '../utils/realtimeHub.js';

const transitions = { DRAFT: 'REGISTRATION_OPEN', REGISTRATION_OPEN: 'REGISTRATION_CLOSED', REGISTRATION_CLOSED: 'LIVE' };

function serialize(row, prizes = []) {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    name: row.name,
    description: row.description,
    tournamentDate: row.tournament_date,
    registrationStartAt: row.registration_start_at,
    registrationEndAt: row.registration_end_at,
    maxTeams: row.max_teams,
    playersPerTeam: row.players_per_team,
    entryType: row.entry_type,
    entryFee: row.entry_fee,
    paymentQrPath: row.payment_qr_path,
    paymentInstructions: row.payment_instructions,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    prizes,
    paymentMethod: row.payment_method,
    upiId: row.upi_id,
    paymentAccountId: row.payment_account_id,
    registeredTeams: Number(row.registered_teams || 0),
    playerRegistrationStatus: row.player_registration_status || 'NONE',
  };
}

async function withPrizes(row) { return row ? serialize(row, await listPrizes(row.id)) : null; }

export async function listAvailableTournaments(filters = {}, viewerId = null) {
  const { rows, total } = await listTournaments({ ...filters, viewerId });
  const tournaments = await Promise.all(rows.map(withPrizes));
  return { tournaments, total };
}

export async function listOrganizerTournaments(organizerId, filters = {}) {
  const { rows, total } = await listTournaments({ ...filters, organizerId });
  const tournaments = await Promise.all(rows.map(withPrizes));
  return { tournaments, total };
}

import { assertTournamentAuthorization, PERMISSIONS } from './authorizationService.js';
import * as staffRepo from '../repositories/staffRepository.js';

export async function getTournament(tournamentId, { organizerId, publicAccess = false, userId } = {}) {
  const row = await findTournament(tournamentId);
  if (!row || (publicAccess && row.status === 'DRAFT')) {
    throw errorResponses.notFound('Tournament not found');
  }

  if (organizerId && row.organizer_id !== organizerId) {
    if (userId) {
      try {
        const staff = await assertTournamentAuthorization(tournamentId, userId, {
          permission: PERMISSIONS.VIEW_TOURNAMENT,
        });
        if (!staff.isStaff) throw errorResponses.notFound('Tournament not found');
      } catch {
        throw errorResponses.notFound('Tournament not found');
      }
    } else {
      throw errorResponses.notFound('Tournament not found');
    }
  }

  return withPrizes(row);
}

async function validatePaymentSettings(input, organizerId) {
  if (input.entryType === 'PAID') {
    const fee = Number(input.entryFee);
    if (isNaN(fee) || fee <= 0) {
      throw errorResponses.validation({ entryFee: 'Entry fee must be greater than 0' });
    }
    
    if (input.paymentMethod === 'MANUAL_UPI') {
      if (!input.upiId?.trim()) {
        throw errorResponses.validation({ upiId: 'UPI ID is required for Manual UPI payments' });
      }
    } else if (input.paymentMethod === 'ONLINE') {
      const account = await paymentRepo.findPaymentAccount(organizerId, 'ONLINE');
      if (!account || account.status !== 'ACTIVE') {
        throw errorResponses.validation({ paymentMethod: 'Payment account not connected. Please connect your payment account.' });
      }
      input.paymentAccountId = account.id;
    }
  }
}

export async function createOrganizerTournament(input, organizerId) {
  await validatePaymentSettings(input, organizerId);
  const org = await staffRepo.ensureDefaultOrganization(organizerId);
  const id = await createTournament({
    ...input,
    organizerId,
    organizationId: org.id,
    entryFee: input.entryType === 'FREE' ? 0 : Number(input.entryFee),
  });
  return getTournament(id, { organizerId });
}

export async function updateOrganizerTournament(tournamentId, input, userId) {
  const authContext = await assertTournamentAuthorization(tournamentId, userId, {
    permission: input.status ? PERMISSIONS.START_TOURNAMENT : PERMISSIONS.EDIT_TOURNAMENT,
    isWrite: true,
  });
  const current = authContext.tournament;

  if (input.status && input.status !== current.status && transitions[current.status] !== input.status) {
    throw errorResponses.conflict(`Invalid tournament transition from ${current.status} to ${input.status}`);
  }
  if (input.status === 'COMPLETED') {
    throw errorResponses.conflict('Tournament completion is handled after competition finalization');
  }
  
  const merged = { ...current, ...input };
  merged.entryType = merged.entry_type;
  merged.entryFee = merged.entry_fee;
  merged.paymentMethod = merged.payment_method;
  merged.upiId = merged.upi_id;

  if (input.entryType !== undefined || input.entryFee !== undefined || input.paymentMethod !== undefined || input.upiId !== undefined) {
    await validatePaymentSettings(merged, current.organizer_id);
  }

  await updateTournament(tournamentId, {
    ...input,
    name: input.name?.trim(),
    entryFee: input.entryType === 'FREE' ? 0 : input.entryFee,
  });

  await staffRepo.insertAuditLog({
    tournamentId: Number(tournamentId),
    userId,
    actorId: userId,
    action: input.status ? 'TOURNAMENT_STATUS_UPDATED' : 'TOURNAMENT_UPDATED',
    entityType: 'TOURNAMENT',
    entityId: Number(tournamentId),
    metadata: input,
  });

  return getTournament(tournamentId, { organizerId: current.organizer_id, userId });
}

export async function getTournamentQrFile(tournamentId) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || !tournament.payment_qr_path) {
    throw errorResponses.notFound('Payment QR code not found');
  }
  return path.resolve(config.uploadDirectory, 'payment-qrs', path.basename(tournament.payment_qr_path));
}

export async function deleteTournament(tournamentId, userId, role) {
  const current = await findTournament(tournamentId);
  if (!current) throw errorResponses.notFound('Tournament not found');
  if (role !== 'ADMIN' && current.organizer_id !== userId) {
    throw errorResponses.forbidden('You are not authorized to delete this tournament');
  }

  await repoDeleteTournament(tournamentId);
  emitRealtime(realtimeRooms.tournament(tournamentId), 'tournament_deleted', { tournamentId: Number(tournamentId) });
  return { success: true, tournamentId: Number(tournamentId) };
}

