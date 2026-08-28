import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import * as scoutController from '../controllers/scoutController.js';

export const scoutRouter = Router();

scoutRouter.use(authenticateRequest);

scoutRouter.get('/tournaments', scoutController.listAssignedTournaments);
scoutRouter.get('/tournaments/:tournamentId', scoutController.getScoutTournamentOverview);
scoutRouter.get('/tournaments/:tournamentId/groups/:groupId', scoutController.getScoutGroupDetails);
