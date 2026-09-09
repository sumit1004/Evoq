import { Router } from 'express';
import {
  deleteOrgBannerController,
  deleteOrgLogoController,
  getMyOrganizationController,
  getOrganizationProfileController,
  getOrganizationTournamentsController,
  listOrganizationsController,
  updateMyOrganizationController,
  uploadOrgBannerController,
  uploadOrgLogoController,
} from '../controllers/organizationController.js';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateOrganizationUpdate } from '../validators/organizationValidators.js';
import { uploadOrgBanner, uploadOrgLogo } from '../middleware/uploadMiddleware.js';

export const organizationRouter = Router();

// --- Protected Organizer Endpoints (placed before :idOrSlug to avoid collisions) ---
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
organizationRouter.post(
  '/me/logo',
  authenticateRequest,
  requireRoles('ORGANIZER'),
  uploadOrgLogo,
  uploadOrgLogoController,
);
organizationRouter.delete(
  '/me/logo',
  authenticateRequest,
  requireRoles('ORGANIZER'),
  deleteOrgLogoController,
);
organizationRouter.post(
  '/me/banner',
  authenticateRequest,
  requireRoles('ORGANIZER'),
  uploadOrgBanner,
  uploadOrgBannerController,
);
organizationRouter.delete(
  '/me/banner',
  authenticateRequest,
  requireRoles('ORGANIZER'),
  deleteOrgBannerController,
);

// --- Public Endpoints (Accessible to players and public) ---
organizationRouter.get('/', listOrganizationsController);
organizationRouter.get('/:idOrSlug', getOrganizationProfileController);
organizationRouter.get('/:idOrSlug/tournaments', getOrganizationTournamentsController);

