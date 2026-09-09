import { Router } from 'express';
import { getMyProfile, getPlayerDashboardController, patchMyProfile } from '../controllers/identityController.js';
import {
  getMyEsportsProfileController,
  updateMyEsportsProfileController,
  listGameProfilesController,
  createGameProfileController,
  updateGameProfileController,
  deleteGameProfileController,
  listPracticeSessionsController,
  getPracticeSessionController,
  createPracticeSessionController,
  updatePracticeSessionController,
  deletePracticeSessionController,
  listPracticeMatchesController,
  createPracticeMatchController,
  updatePracticeMatchController,
  deletePracticeMatchController,
  getPlayerTournamentHistoryController,
  getPlayerMatchHistoryController,
  searchPlayerController,
  getPublicPlayerProfileController,
} from '../controllers/playerProfileController.js';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateProfilePatch } from '../validators/identityValidators.js';
import {
  validateEsportsProfileUpdate,
  validateGameProfileCreate,
  validateGameProfileUpdate,
  validatePracticeSessionCreate,
  validatePracticeSessionUpdate,
  validatePracticeMatchInput,
} from '../validators/playerProfileValidators.js';

export const playerRouter = Router();

// --- Public Endpoints (Accessible without auth or with auth) ---
playerRouter.get('/search', searchPlayerController);
playerRouter.get('/:evoqId/public', getPublicPlayerProfileController);

// --- Protected Player Endpoints ---
const playerAuth = [authenticateRequest, requireRoles('PLAYER')];

// Legacy identity endpoints
playerRouter.get('/me', ...playerAuth, getMyProfile);
playerRouter.get('/dashboard', ...playerAuth, getPlayerDashboardController);
playerRouter.patch('/me', ...playerAuth, validateRequest({ body: validateProfilePatch }), patchMyProfile);

// Esports Profile & Settings
playerRouter.get('/profile', ...playerAuth, getMyEsportsProfileController);
playerRouter.put('/profile', ...playerAuth, validateRequest({ body: validateEsportsProfileUpdate }), updateMyEsportsProfileController);

// Game Profiles
playerRouter.get('/games', ...playerAuth, listGameProfilesController);
playerRouter.post('/games', ...playerAuth, validateRequest({ body: validateGameProfileCreate }), createGameProfileController);
playerRouter.put('/games/:gameId', ...playerAuth, validateRequest({ body: validateGameProfileUpdate }), updateGameProfileController);
playerRouter.delete('/games/:gameId', ...playerAuth, deleteGameProfileController);

// Practice Sessions & Scrims
playerRouter.get('/practice/sessions', ...playerAuth, listPracticeSessionsController);
playerRouter.post('/practice/sessions', ...playerAuth, validateRequest({ body: validatePracticeSessionCreate }), createPracticeSessionController);
playerRouter.get('/practice/sessions/:sessionId', ...playerAuth, getPracticeSessionController);
playerRouter.put('/practice/sessions/:sessionId', ...playerAuth, validateRequest({ body: validatePracticeSessionUpdate }), updatePracticeSessionController);
playerRouter.delete('/practice/sessions/:sessionId', ...playerAuth, deletePracticeSessionController);

// Practice Matches
playerRouter.get('/practice/matches', ...playerAuth, listPracticeMatchesController);
playerRouter.post('/practice/sessions/:sessionId/matches', ...playerAuth, validateRequest({ body: validatePracticeMatchInput }), createPracticeMatchController);
playerRouter.put('/practice/matches/:matchId', ...playerAuth, validateRequest({ body: validatePracticeMatchInput }), updatePracticeMatchController);
playerRouter.delete('/practice/matches/:matchId', ...playerAuth, deletePracticeMatchController);

// Match & Tournament Histories
playerRouter.get('/tournaments/history', ...playerAuth, getPlayerTournamentHistoryController);
playerRouter.get('/matches', ...playerAuth, getPlayerMatchHistoryController);
