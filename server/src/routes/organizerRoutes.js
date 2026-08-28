import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { getDashboardController } from '../controllers/organizerController.js';
import * as staffController from '../controllers/staffController.js';

import * as staffRepo from '../repositories/staffRepository.js';
import { errorResponses } from '../errors/AppError.js';

export const organizerRouter = Router();

organizerRouter.use(authenticateRequest);

organizerRouter.get('/dashboard', async (req, res, next) => {
  if (['ORGANIZER', 'ADMIN'].includes(req.user?.role)) {
    return next();
  }
  try {
    const scoutCount = await staffRepo.countActiveStaffAssignments(req.user.id);
    if (scoutCount > 0) {
      return next();
    }
    return next(errorResponses.forbidden('Organizer or Scout access required'));
  } catch (err) {
    return next(err);
  }
}, getDashboardController);

organizerRouter.get('/scouts/search', requireRoles('ORGANIZER', 'ADMIN'), staffController.searchScouts);
organizerRouter.get('/scouts/organization', requireRoles('ORGANIZER', 'ADMIN'), staffController.listMyOrganizationStaff);
