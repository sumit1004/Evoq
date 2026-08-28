import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import * as staffController from '../controllers/staffController.js';

export const staffRouter = Router({ mergeParams: true });

staffRouter.use(authenticateRequest);

staffRouter.get('/', staffController.listTournamentStaff);
staffRouter.post('/', staffController.assignTournamentStaff);
staffRouter.put('/:staffId', staffController.updateTournamentStaff);
staffRouter.delete('/:staffId', staffController.revokeTournamentStaff);
staffRouter.get('/audit-logs', staffController.listAuditLogs);
