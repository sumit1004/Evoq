import { Router } from 'express';
import { createRegistrationController, createTournamentController, exportRegistrationsController, exportRegistrationsWorkbookController, getPaymentEvidenceController, getRegistrationController, getTournamentController, listRegistrationsController, listTournaments, reviewRegistrationController, updateTournamentController } from '../controllers/tournamentController.js';
import { authenticateRequest, optionalAuthentication } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { uploadPaymentEvidence } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateRegistrationCreate, validateRegistrationId, validateRegistrationReview } from '../validators/registrationValidators.js';
import { validateTournamentCreate, validateTournamentId, validateTournamentPatch } from '../validators/tournamentValidators.js';

export const tournamentRouter = Router();

tournamentRouter.get('/', optionalAuthentication, listTournaments);
tournamentRouter.post('/', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ body: validateTournamentCreate }), createTournamentController);
tournamentRouter.get('/:tournamentId', optionalAuthentication, validateRequest({ params: validateTournamentId }), getTournamentController);
tournamentRouter.patch('/:tournamentId', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId, body: validateTournamentPatch }), updateTournamentController);
tournamentRouter.get('/:tournamentId/registrations', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER'), validateRequest({ params: validateTournamentId }), listRegistrationsController);
tournamentRouter.post('/:tournamentId/registrations', authenticateRequest, requireRoles('PLAYER'), validateRequest({ params: validateTournamentId, body: validateRegistrationCreate }), uploadPaymentEvidence, createRegistrationController);
tournamentRouter.get('/:tournamentId/registrations/export', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), exportRegistrationsController);
tournamentRouter.get('/:tournamentId/registrations/export.xlsx', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), exportRegistrationsWorkbookController);

export const registrationRouter = Router();
registrationRouter.get('/:registrationId', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER'), validateRequest({ params: validateRegistrationId }), getRegistrationController);
registrationRouter.patch('/:registrationId', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateRegistrationId, body: validateRegistrationReview }), reviewRegistrationController);
registrationRouter.get('/:registrationId/payment-evidence', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateRegistrationId }), getPaymentEvidenceController);
