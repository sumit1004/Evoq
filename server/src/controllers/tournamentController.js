import { asyncHandler } from '../utils/asyncHandler.js';
import * as scoringService from '../services/scoringService.js';
import { createOrganizerTournament, deleteTournament, getTournament, getTournamentQrFile, listAvailableTournaments, listOrganizerTournaments, updateOrganizerTournament } from '../services/tournamentService.js';
import {
  buildTournamentRegistrationWorkbook,
  exportTournamentRegistrations,
  getRegistrationFile,
  getRegistrationForOrganizer,
  getRegistrationForPlayer,
  listPlayerTournamentRegistrations,
  listTournamentRegistrations,
  listTournamentRegistrationsPage,
  createPlayerRegistration,
  reviewTournamentRegistration,
  bulkVerifyRegistrations,
  bulkRejectRegistrations
} from '../services/registrationService.js';

import * as authorizationService from '../services/authorizationService.js';
import { errorResponses } from '../errors/AppError.js';

export const listTournaments = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const entryType = req.query.entryType || '';
  const sort = req.query.sort || 'default';

  const filters = { page, limit, search, status, entryType, sort };

  let result;
  if (req.user && (req.user.role === 'ORGANIZER' || req.query.scope === 'mine')) {
    result = await listOrganizerTournaments(req.user.id, filters);
  } else {
    result = await listAvailableTournaments(filters, req.user?.id);
  }

  res.status(200).json({
    tournaments: result.tournaments,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit)
    }
  });
});

export const getTournamentController = asyncHandler(async (req, res) => {
  const ownOrganizer = req.user?.role === 'ORGANIZER' ? req.user.id : undefined;
  res.status(200).json({
    tournament: await getTournament(Number(req.params.tournamentId), {
      organizerId: ownOrganizer,
      userId: req.user?.id,
      publicAccess: !req.user,
    }),
  });
});

export const getEffectiveAccessController = asyncHandler(async (req, res) => {
  const tournamentId = Number(req.params.tournamentId);
  const userId = req.user.id;
  const access = await authorizationService.getEffectiveTournamentAccess(userId, tournamentId);
  if (!access) {
    throw errorResponses.notFound('Tournament not found');
  }
  res.status(200).json({ access });
});

export const createTournamentController = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    body.paymentQrPath = req.file.filename;
  }
  res.status(201).json({ tournament: await createOrganizerTournament(body, req.user.id) });
});

export const updateTournamentController = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    body.paymentQrPath = req.file.filename;
  }
  res.status(200).json({ tournament: await updateOrganizerTournament(Number(req.params.tournamentId), body, req.user.id) });
});

export const deleteTournamentController = asyncHandler(async (req, res) => {
  res.status(200).json(await deleteTournament(Number(req.params.tournamentId), req.user.id, req.user.role));
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

export const exportRegistrationsWorkbookController = asyncHandler(async (req, res) => {
  const buffer = await buildTournamentRegistrationWorkbook(Number(req.params.tournamentId), req.user.id);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition', `attachment; filename="tournament-${req.params.tournamentId}-registrations.xlsx"`).send(buffer);
});

export const getPaymentEvidenceController = asyncHandler(async (req, res) => {
  const filePath = await getRegistrationFile(Number(req.params.registrationId), req.user.id);
  res.sendFile(filePath);
});

export const getTournamentQrController = asyncHandler(async (req, res) => {
  const filePath = await getTournamentQrFile(Number(req.params.tournamentId));
  res.sendFile(filePath);
});

export const bulkVerifyController = asyncHandler(async (req, res) => {
  const registrationIds = Array.isArray(req.body.registrationIds) ? req.body.registrationIds.map(Number) : [];
  const result = await bulkVerifyRegistrations(registrationIds, req.user.id);
  res.status(200).json(result);
});

export const bulkRejectController = asyncHandler(async (req, res) => {
  const registrationIds = Array.isArray(req.body.registrationIds) ? req.body.registrationIds.map(Number) : [];
  const result = await bulkRejectRegistrations(registrationIds, req.body.rejectionReason, req.user.id);
  res.status(200).json(result);
});

export const getScoringConfigController = asyncHandler(async (req, res) => {
  const config = await scoringService.getTournamentScoringConfig(Number(req.params.tournamentId));
  res.status(200).json({ config });
});

export const updateScoringConfigController = asyncHandler(async (req, res) => {
  const config = await scoringService.updateTournamentScoringConfig(Number(req.params.tournamentId), req.body, req.user.id);
  res.status(200).json({ config });
});
