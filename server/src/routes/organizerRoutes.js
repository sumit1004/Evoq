import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { getDashboardController } from '../controllers/organizerController.js';

export const organizerRouter = Router();

organizerRouter.use(authenticateRequest, requireRoles('ORGANIZER'));
organizerRouter.get('/dashboard', getDashboardController);
