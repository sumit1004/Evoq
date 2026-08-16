import { errorResponses } from '../errors/AppError.js';
import { createTournament, findTournament, listPrizes, listTournaments, updateTournament } from '../repositories/tournamentRepository.js';

const transitions = { DRAFT: 'REGISTRATION_OPEN', REGISTRATION_OPEN: 'REGISTRATION_CLOSED', REGISTRATION_CLOSED: 'LIVE' };

function serialize(row, prizes = []) {
  return { id: row.id, organizerId: row.organizer_id, name: row.name, description: row.description, tournamentDate: row.tournament_date, registrationStartAt: row.registration_start_at, registrationEndAt: row.registration_end_at, maxTeams: row.max_teams, playersPerTeam: row.players_per_team, entryType: row.entry_type, entryFee: row.entry_fee, paymentQrPath: row.payment_qr_path, paymentInstructions: row.payment_instructions, status: row.status, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at, prizes };
}

async function withPrizes(row) { return row ? serialize(row, await listPrizes(row.id)) : null; }

export async function listAvailableTournaments() { return Promise.all((await listTournaments()).map(withPrizes)); }
export async function listOrganizerTournaments(organizerId) { return Promise.all((await listTournaments({ organizerId })).map(withPrizes)); }

export async function getTournament(tournamentId, { organizerId, publicAccess = false } = {}) {
  const row = await findTournament(tournamentId);
  if (!row || (publicAccess && row.status === 'DRAFT') || (organizerId && row.organizer_id !== organizerId)) throw errorResponses.notFound('Tournament not found');
  return withPrizes(row);
}

export async function createOrganizerTournament(input, organizerId) {
  const id = await createTournament({ ...input, organizerId, entryFee: input.entryType === 'FREE' ? 0 : Number(input.entryFee) });
  return getTournament(id, { organizerId });
}

export async function updateOrganizerTournament(tournamentId, input, organizerId) {
  const current = await findTournament(tournamentId);
  if (!current || current.organizer_id !== organizerId) throw errorResponses.notFound('Tournament not found');
  if (current.status === 'COMPLETED') throw errorResponses.conflict('Completed tournaments are read-only');
  if (input.status && input.status !== current.status && transitions[current.status] !== input.status) throw errorResponses.conflict(`Invalid tournament transition from ${current.status} to ${input.status}`);
  if (input.status === 'COMPLETED') throw errorResponses.conflict('Tournament completion is handled after competition finalization');
  await updateTournament(tournamentId, { ...input, name: input.name?.trim(), entryFee: input.entryType === 'FREE' ? 0 : input.entryFee });
  return getTournament(tournamentId, { organizerId });
}
