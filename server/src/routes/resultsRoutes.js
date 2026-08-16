import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { uploadResultMedia } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import * as controller from '../controllers/resultsController.js';
import { validateGroupLeaderboardParams, validateMatchId, validateMatchResultParams, validateQualificationCreate, validateQualificationParams, validateResultCreate, validateRoundId, validateRoundLeaderboardParams, validateTournamentResultsParams } from '../validators/resultValidators.js';
import { mutationRateLimiter } from '../middleware/securityMiddleware.js';

const authenticated = [authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN')];
const organizer = [authenticateRequest, requireRoles('ORGANIZER', 'ADMIN')];
export const resultsRouter = Router();

resultsRouter.get('/matches/:matchId/results', ...authenticated, validateRequest({ params: validateMatchResultParams }), controller.listMatchResults);
resultsRouter.post('/matches/:matchId/results', mutationRateLimiter, ...organizer, validateRequest({ params: validateMatchResultParams, body: validateResultCreate }), uploadResultMedia, controller.createMatchResult);
resultsRouter.get('/tournaments/:tournamentId/results', ...authenticated, validateRequest({ params: validateTournamentResultsParams }), controller.tournamentResults);
resultsRouter.get('/tournaments/:tournamentId/leaderboards', ...authenticated, validateRequest({ params: validateTournamentResultsParams }), controller.tournamentLeaderboard);

resultsRouter.get('/matches/:matchId/leaderboard', ...authenticated, validateRequest({ params: validateMatchId }), controller.matchLeaderboard);
resultsRouter.post('/matches/:matchId/leaderboard/recalculate', mutationRateLimiter, ...organizer, validateRequest({ params: validateMatchId }), controller.recalculateLeaderboard);
resultsRouter.get('/groups/:groupId/leaderboard', ...authenticated, validateRequest({ params: validateGroupLeaderboardParams }), controller.groupLeaderboard);
resultsRouter.get('/rounds/:roundId/leaderboard', ...authenticated, validateRequest({ params: validateRoundLeaderboardParams }), controller.roundLeaderboard);

resultsRouter.get('/rounds/:roundId/qualifications', ...authenticated, validateRequest({ params: validateRoundId }), controller.qualifications);
resultsRouter.post('/rounds/:roundId/qualifications', ...organizer, validateRequest({ params: validateRoundId, body: validateQualificationCreate }), controller.selectQualification);
resultsRouter.delete('/rounds/:roundId/qualifications/:teamId', ...organizer, validateRequest({ params: validateQualificationParams }), controller.removeQualification);
