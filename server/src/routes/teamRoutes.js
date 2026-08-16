import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createTeamController, deleteTeamController, getTeam, listTeams } from '../controllers/teamController.js';
import { validateTeamCreate, validateTeamId } from '../validators/teamValidators.js';

export const teamRouter = Router();

teamRouter.use(authenticateRequest, requireRoles('PLAYER'));
teamRouter.get('/', listTeams);
teamRouter.post('/', validateRequest({ body: validateTeamCreate }), createTeamController);
teamRouter.get('/:teamId', validateRequest({ params: validateTeamId }), getTeam);
teamRouter.delete('/:teamId', validateRequest({ params: validateTeamId }), deleteTeamController);
