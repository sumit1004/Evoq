import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import { countRegistrations, findPlayerRegistration, findRegistration, findRegistrationFile, getRegistrationContext, insertRegistration, listPlayerRegistrations, listRegistrations, reviewRegistration } from '../repositories/registrationRepository.js';
import { findTournament } from '../repositories/tournamentRepository.js';

function groupRows(rows) {
  if (!rows.length) return null;
  const first = rows[0];
  return { id: first.id, tournamentId: first.tournament_id, tournamentName: first.tournament_name, teamId: first.team_id, teamName: first.team_name, status: first.status, entryType: first.entry_type, transactionId: first.transaction_id, paymentScreenshotPath: first.payment_screenshot_path, submittedAt: first.submitted_at, verifiedAt: first.verified_at, rejectionReason: first.rejection_reason, organizerId: first.organizer_id, members: rows.map((row) => ({ id: row.member_id, name: row.member_name, email: row.member_email, uniquePlayerId: row.unique_player_id })) };
}

export async function listTournamentRegistrations(tournamentId, organizerId) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) throw errorResponses.notFound('Tournament not found');
  const grouped = new Map();
  for (const row of await listRegistrations(tournamentId)) grouped.set(row.id, [...(grouped.get(row.id) || []), row]);
  return [...grouped.values()].map(groupRows);
}

export async function listTournamentRegistrationsPage(tournamentId, organizerId, options = {}) {
  const tournament = await findTournament(tournamentId);
  if (!tournament || tournament.organizer_id !== organizerId) throw errorResponses.notFound('Tournament not found');
  const page = Math.max(1, Number(options.page) || 1); const limit = Math.min(100, Math.max(1, Number(options.limit) || 20)); const filters = { status: options.status, search: options.search };
  const [rows, total] = await Promise.all([listRegistrations(tournamentId, { ...filters, pagination: { limit, offset: (page - 1) * limit } }), countRegistrations(tournamentId, filters)]);
  const grouped = new Map(); for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) || []), row]);
  return { registrations: [...grouped.values()].map(groupRows), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listPlayerTournamentRegistrations(tournamentId, userId) {
  const grouped = new Map();
  for (const row of await listPlayerRegistrations(tournamentId, userId)) grouped.set(row.id, [...(grouped.get(row.id) || []), row]);
  return [...grouped.values()].map((rows) => {
    const item = groupRows(rows);
    delete item.paymentScreenshotPath;
    item.members = item.members.map(({ email: _email, ...member }) => member);
    return item;
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportTournamentRegistrations(tournamentId, organizerId) {
  const registrations = await listTournamentRegistrations(tournamentId, organizerId);
  const header = ['registration_id', 'status', 'team_name', 'member_name', 'member_email', 'unique_player_id', 'transaction_id', 'submitted_at', 'rejection_reason'];
  const lines = [header.map(csvCell).join(',')];
  for (const registration of registrations) {
    for (const member of registration.members) lines.push([registration.id, registration.status, registration.teamName, member.name, member.email, member.uniquePlayerId, registration.transactionId, registration.submittedAt, registration.rejectionReason].map(csvCell).join(','));
  }
  return lines.join('\r\n');
}

export async function buildTournamentRegistrationWorkbook(tournamentId, organizerId) {
  const ExcelJS = (await import('exceljs')).default;
  const tournament = await findTournament(tournamentId); if (!tournament || tournament.organizer_id !== organizerId) throw errorResponses.notFound('Tournament not found');
  const registrations = await listTournamentRegistrations(tournamentId, organizerId); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Registrations');
  sheet.columns = [{ header: 'Tournament Name', key: 'tournamentName', width: 24 }, { header: 'Tournament Date', key: 'tournamentDate', width: 20 }, { header: 'Registration Status', key: 'status', width: 18 }, { header: 'Registration Date', key: 'submittedAt', width: 22 }, { header: 'Team Name', key: 'teamName', width: 24 }, { header: 'Member Name', key: 'memberName', width: 24 }, { header: 'Member Unique ID', key: 'uniquePlayerId', width: 20 }, { header: 'Member Email', key: 'memberEmail', width: 30 }, { header: 'Entry Type', key: 'entryType', width: 14 }, { header: 'Entry Fee', key: 'entryFee', width: 14 }, { header: 'Transaction ID', key: 'transactionId', width: 24 }];
  for (const registration of registrations) for (const member of registration.members) sheet.addRow({ tournamentName: registration.tournamentName, tournamentDate: tournament.tournament_date, status: registration.status, submittedAt: registration.submittedAt, teamName: registration.teamName, memberName: member.name, uniquePlayerId: member.uniquePlayerId, memberEmail: member.email, entryType: registration.entryType, entryFee: tournament.entry_fee, transactionId: registration.transactionId });
  sheet.getRow(1).font = { bold: true }; return workbook.xlsx.writeBuffer();
}

export async function getRegistrationForPlayer(registrationId, userId) {
  const registration = groupRows(await findPlayerRegistration(registrationId, userId));
  if (!registration) throw errorResponses.notFound('Registration not found');
  delete registration.paymentScreenshotPath;
  registration.members = registration.members.map(({ email: _email, ...member }) => member);
  return registration;
}

export async function getRegistrationForOrganizer(registrationId, organizerId) {
  const registration = groupRows(await findRegistration(registrationId));
  if (!registration || registration.organizerId !== organizerId) throw errorResponses.notFound('Registration not found');
  return registration;
}

export async function createPlayerRegistration(tournamentId, input, userId, uploadedFile) {
  const context = await getRegistrationContext(tournamentId, input.teamId);
  if (!context) throw errorResponses.notFound('Tournament or team not found');
  if (context.owner_id !== userId) throw errorResponses.forbidden();
  if (context.tournament_status !== 'REGISTRATION_OPEN') throw errorResponses.conflict('Registration is not open for this tournament');
  if (Number(context.member_count) !== Number(context.players_per_team)) throw errorResponses.validation({ teamId: 'Team size does not match this tournament' });
  if (context.entry_type === 'PAID' && (!uploadedFile || !input.transactionId?.trim())) throw errorResponses.validation({ payment: 'Paid registration requires a transaction ID and payment screenshot' });
  try {
    const id = await insertRegistration({ tournamentId, teamId: input.teamId, transactionId: input.transactionId, paymentScreenshotPath: uploadedFile ? path.basename(uploadedFile.path) : null });
    return getRegistrationForPlayer(id, userId);
  } catch (error) {
    if (uploadedFile && error.code) await fs.unlink(uploadedFile.path).catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') throw errorResponses.conflict('This team is already registered for the tournament');
    throw error;
  }
}

export async function reviewTournamentRegistration(registrationId, input, organizerId) {
  const rows = await findRegistration(registrationId);
  const registration = groupRows(rows);
  if (!registration || registration.organizerId !== organizerId) throw errorResponses.notFound('Registration not found');
  if (registration.status !== 'PENDING') throw errorResponses.conflict('Only pending registrations can be reviewed');
  if (input.status === 'VERIFIED' && !registration.paymentScreenshotPath && registration.entryType === 'PAID') throw errorResponses.conflict('Paid registration requires payment evidence');
  if (!(await reviewRegistration(registrationId, { ...input, verifierId: organizerId }))) throw errorResponses.conflict('Registration was already reviewed');
  return groupRows(await findRegistration(registrationId));
}

export async function getRegistrationFile(registrationId, organizerId) {
  const file = await findRegistrationFile(registrationId);
  if (!file || file.organizer_id !== organizerId || !file.payment_screenshot_path) throw errorResponses.notFound('Payment evidence not found');
  return path.resolve(config.uploadDirectory, 'payment-evidence', path.basename(file.payment_screenshot_path));
}
