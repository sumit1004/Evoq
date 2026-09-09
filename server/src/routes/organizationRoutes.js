import { Router } from 'express';
import {
  listOrganizationsController,
  getOrganizationProfileController,
  getOrganizationTournamentsController,
  getMyOrganizationController,
  updateMyOrganizationController,
} from '../controllers/organizationController.js';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateOrganizationUpdate } from '../validators/organizationValidators.js';

export const organizationRouter = Router();

// --- Public Endpoints (Accessible to players and public) ---
organizationRouter.get('/', listOrganizationsController);
organizationRouter.get('/:idOrSlug', getOrganizationProfileController);
organizationRouter.get('/:idOrSlug/tournaments', getOrganizationTournamentsController);

// --- Protected Organizer Endpoints ---
organizationRouter.get(
  '/me/profile',
  authenticateRequest,
  requireRoles('ORGANIZER'),
  getMyOrganizationController,
);
organizationRouter.put(
  '/me/profile',
  authenticateRequest,
  requireRoles('ORGANIZER'),
  validateRequest({ body: validateOrganizationUpdate }),
  updateMyOrganizationController,
);
