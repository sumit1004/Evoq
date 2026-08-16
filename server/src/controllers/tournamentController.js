import { asyncHandler } from '../utils/asyncHandler.js';
import { createOrganizerTournament, getTournament, listAvailableTournaments, listOrganizerTournaments, updateOrganizerTournament } from '../services/tournamentService.js';
import { buildTournamentRegistrationWorkbook, exportTournamentRegistrations, getRegistrationFile, getRegistrationForOrganizer, getRegistrationForPlayer, listPlayerTournamentRegistrations, listTournamentRegistrations, listTournamentRegistrationsPage, createPlayerRegistration, reviewTournamentRegistration } from '../services/registrationService.js';

export const listTournaments = asyncHandler(async (req, res) => {
  const tournaments = req.user?.role === 'ORGANIZER' && req.query.scope === 'mine' ? await listOrganizerTournaments(req.user.id) : await listAvailableTournaments();
  res.status(200).json({ tournaments });
});

export const getTournamentController = asyncHandler(async (req, res) => {
  const ownOrganizer = req.user?.role === 'ORGANIZER' ? req.user.id : undefined;
  res.status(200).json({ tournament: await getTournament(Number(req.params.tournamentId), { organizerId: ownOrganizer, publicAccess: !ownOrganizer }) });
});

export const createTournamentController = asyncHandler(async (req, res) => {
  res.status(201).json({ tournament: await createOrganizerTournament(req.body, req.user.id) });
});

export const updateTournamentController = asyncHandler(async (req, res) => {
  res.status(200).json({ tournament: await updateOrganizerTournament(Number(req.params.tournamentId), req.body, req.user.id) });
});

export const listRegistrationsController = asyncHandler(async (req, res) => {
  const result = req.user.role === 'ORGANIZER'
    ? (Object.keys(req.query).length ? await listTournamentRegistrationsPage(Number(req.params.tournamentId), req.user.id, req.query) : { registrations: await listTournamentRegistrations(Number(req.params.tournamentId), req.user.id) })
    : await listPlayerTournamentRegistrations(Number(req.params.tournamentId), req.user.id);
  res.status(200).json(req.user.role === 'ORGANIZER' ? result : { registrations: result });
});

export const createRegistrationController = asyncHandler(async (req, res) => {
  res.status(201).json({ registration: await createPlayerRegistration(Number(req.params.tournamentId), req.body, req.user.id, req.file) });
});

export const reviewRegistrationController = asyncHandler(async (req, res) => {
  res.status(200).json({ registration: await reviewTournamentRegistration(Number(req.params.registrationId), req.body, req.user.id) });
});

export const getRegistrationController = asyncHandler(async (req, res) => {
  const registration = req.user.role === 'ORGANIZER'
    ? await getRegistrationForOrganizer(Number(req.params.registrationId), req.user.id)
    : await getRegistrationForPlayer(Number(req.params.registrationId), req.user.id);
  res.status(200).json({ registration });
});

export const exportRegistrationsController = asyncHandler(async (req, res) => {
  const csv = await exportTournamentRegistrations(Number(req.params.tournamentId), req.user.id);
  res.type('text/csv').set('Content-Disposition', `attachment; filename="tournament-${req.params.tournamentId}-registrations.csv"`).send(csv);
});

export const exportRegistrationsWorkbookController = asyncHandler(async (req, res) => { const buffer = await buildTournamentRegistrationWorkbook(Number(req.params.tournamentId), req.user.id); res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition', `attachment; filename="tournament-${req.params.tournamentId}-registrations.xlsx"`).send(buffer); });

export const getPaymentEvidenceController = asyncHandler(async (req, res) => {
  const filePath = await getRegistrationFile(Number(req.params.registrationId), req.user.id);
  res.sendFile(filePath);
});
