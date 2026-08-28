import { Router } from 'express';
import {
  createRegistrationController,
  createTournamentController,
  deleteTournamentController,
  exportRegistrationsController,
  exportRegistrationsWorkbookController,
  getPaymentEvidenceController,
  getRegistrationController,
  getTournamentController,
  listRegistrationsController,
  listTournaments,
  reviewRegistrationController,
  updateTournamentController,
  getTournamentQrController,
  bulkVerifyController,
  bulkRejectController,
  getScoringConfigController,
  updateScoringConfigController
} from '../controllers/tournamentController.js';
import { authenticateRequest, optionalAuthentication } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { uploadPaymentEvidence, uploadPaymentQr } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateRegistrationCreate, validateRegistrationId, validateRegistrationReview } from '../validators/registrationValidators.js';
import { validateTournamentCreate, validateTournamentId, validateTournamentPatch } from '../validators/tournamentValidators.js';

import { staffRouter } from './staffRoutes.js';

export const tournamentRouter = Router();

tournamentRouter.get('/', optionalAuthentication, listTournaments);
tournamentRouter.post('/', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), uploadPaymentQr, validateRequest({ body: validateTournamentCreate }), createTournamentController);
tournamentRouter.get('/:tournamentId', optionalAuthentication, validateRequest({ params: validateTournamentId }), getTournamentController);
tournamentRouter.patch('/:tournamentId', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), uploadPaymentQr, validateRequest({ params: validateTournamentId, body: validateTournamentPatch }), updateTournamentController);
tournamentRouter.delete('/:tournamentId', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), deleteTournamentController);
tournamentRouter.get('/:tournamentId/scoring-config', optionalAuthentication, validateRequest({ params: validateTournamentId }), getScoringConfigController);
tournamentRouter.put('/:tournamentId/scoring-config', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), updateScoringConfigController);
tournamentRouter.get('/:tournamentId/registrations', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), listRegistrationsController);
tournamentRouter.post('/:tournamentId/registrations', authenticateRequest, requireRoles('PLAYER'), uploadPaymentEvidence, validateRequest({ params: validateTournamentId, body: validateRegistrationCreate }), createRegistrationController);
tournamentRouter.get('/:tournamentId/registrations/export', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), exportRegistrationsController);
tournamentRouter.get('/:tournamentId/registrations/export.xlsx', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), exportRegistrationsWorkbookController);
tournamentRouter.get('/:tournamentId/payment-qr', optionalAuthentication, validateRequest({ params: validateTournamentId }), getTournamentQrController);
tournamentRouter.use('/:tournamentId/staff', staffRouter);

export const registrationRouter = Router();
registrationRouter.post('/bulk-verify', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), bulkVerifyController);
registrationRouter.post('/bulk-reject', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), bulkRejectController);
registrationRouter.get('/:registrationId', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateRegistrationId }), getRegistrationController);
registrationRouter.patch('/:registrationId', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateRegistrationId, body: validateRegistrationReview }), reviewRegistrationController);
registrationRouter.get('/:registrationId/payment-evidence', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateRegistrationId }), getPaymentEvidenceController);
