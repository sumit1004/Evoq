import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { getDashboardController } from '../controllers/organizerController.js';
import * as staffController from '../controllers/staffController.js';

export const organizerRouter = Router();

organizerRouter.use(authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'));
organizerRouter.get('/dashboard', getDashboardController);
organizerRouter.get('/scouts/search', staffController.searchScouts);
organizerRouter.get('/scouts/organization', staffController.listMyOrganizationStaff);
