import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import * as controller from '../controllers/archiveController.js';
import { validateHistoryId, validateTournamentId } from '../validators/historyValidators.js';

export const archiveRouter = Router();
archiveRouter.post('/tournaments/:tournamentId/complete', authenticateRequest, requireRoles('ORGANIZER'), validateRequest({ params: validateTournamentId }), controller.completeTournament);
archiveRouter.get('/tournaments/:tournamentId/archive', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateTournamentId }), controller.getTournamentArchive);
archiveRouter.get('/history', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), controller.listHistory);
archiveRouter.get('/history/:historyId', authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN'), validateRequest({ params: validateHistoryId }), controller.getHistory);
archiveRouter.delete('/history/:historyId', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), validateRequest({ params: validateHistoryId }), controller.deleteHistory);
