import { Router } from 'express';
import { getMyProfile, patchMyProfile } from '../controllers/identityController.js';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateProfilePatch } from '../validators/identityValidators.js';

export const playerRouter = Router();

playerRouter.use(authenticateRequest, requireRoles('PLAYER'));
playerRouter.get('/me', getMyProfile);
playerRouter.patch('/me', validateRequest({ body: validateProfilePatch }), patchMyProfile);
