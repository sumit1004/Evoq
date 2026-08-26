import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import * as controller from '../controllers/competitionController.js';
import {
  validateAutoAssign,
  validateBulkMove,
  validateGroupCreate,
  validateGroupId,
  validateGroupPatch,
  validateGroupTeamParams,
  validateMatchCreate,
  validateMatchId,
  validateMatchPatch,
  validateNextRoundCreate,
  validateRoundCreate,
  validateRoundId,
  validateTournamentRoundId
} from '../validators/competitionValidators.js';

const organizer = [authenticateRequest, requireRoles('ORGANIZER', 'ADMIN')];
const authenticated = [authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN')];
export const competitionRouter = Router();

competitionRouter.get('/tournaments/:tournamentId/rounds', ...organizer, validateRequest({ params: validateTournamentRoundId }), controller.listRounds);
competitionRouter.post('/tournaments/:tournamentId/rounds', ...organizer, validateRequest({ params: validateTournamentRoundId, body: validateRoundCreate }), controller.createRound);
competitionRouter.post('/tournaments/:tournamentId/rounds/next', ...organizer, validateRequest({ params: validateTournamentRoundId, body: validateNextRoundCreate }), controller.createNextRound);
competitionRouter.get('/rounds/:roundId', ...organizer, validateRequest({ params: validateRoundId }), controller.getRound);
competitionRouter.patch('/rounds/:roundId', ...organizer, validateRequest({ params: validateRoundId, body: (body) => body.status ? {} : { status: 'status is required' } }), controller.updateRoundStatus);
competitionRouter.post('/rounds/:roundId/complete', ...organizer, validateRequest({ params: validateRoundId }), controller.completeRound);

competitionRouter.get('/rounds/:roundId/groups', ...organizer, validateRequest({ params: validateRoundId }), controller.listGroups);
competitionRouter.get('/tournaments/:tournamentId/groups', ...authenticated, validateRequest({ params: validateTournamentRoundId }), controller.listPlayerTournamentGroups);
competitionRouter.get('/rounds/:roundId/eligible-teams', ...organizer, validateRequest({ params: validateRoundId }), controller.listEligibleTeams);
competitionRouter.post('/rounds/:roundId/auto-assign', ...organizer, validateRequest({ params: validateRoundId, body: validateAutoAssign }), controller.autoAssign);
competitionRouter.post('/rounds/:roundId/bulk-move', ...organizer, validateRequest({ params: validateRoundId, body: validateBulkMove }), controller.bulkMove);
competitionRouter.post('/rounds/:roundId/lock', ...organizer, validateRequest({ params: validateRoundId }), controller.lockAssignment);
competitionRouter.post('/rounds/:roundId/groups', ...organizer, validateRequest({ params: validateRoundId, body: validateGroupCreate }), controller.createGroup);
competitionRouter.get('/groups/:groupId', ...authenticated, validateRequest({ params: validateGroupId }), controller.getGroup);
competitionRouter.patch('/groups/:groupId', ...organizer, validateRequest({ params: validateGroupId, body: validateGroupPatch }), controller.updateGroup);
competitionRouter.post('/groups/:groupId/complete', ...organizer, validateRequest({ params: validateGroupId }), controller.completeGroup);
competitionRouter.delete('/groups/:groupId', ...organizer, validateRequest({ params: validateGroupId }), controller.deleteGroup);
competitionRouter.post('/groups/:groupId/teams/:teamId', ...organizer, validateRequest({ params: validateGroupTeamParams }), controller.assignTeam);
competitionRouter.delete('/groups/:groupId/teams/:teamId', ...organizer, validateRequest({ params: validateGroupTeamParams }), controller.removeTeam);

competitionRouter.get('/groups/:groupId/matches', ...authenticated, validateRequest({ params: validateGroupId }), controller.listMatches);
competitionRouter.post('/groups/:groupId/matches', ...organizer, validateRequest({ params: validateGroupId, body: validateMatchCreate }), controller.createMatch);
competitionRouter.get('/matches/:matchId', ...authenticated, validateRequest({ params: validateMatchId }), controller.getMatch);
competitionRouter.patch('/matches/:matchId', ...organizer, validateRequest({ params: validateMatchId, body: validateMatchPatch }), controller.updateMatch);
competitionRouter.post('/matches/:matchId/complete', ...organizer, validateRequest({ params: validateMatchId }), controller.completeMatch);
competitionRouter.delete('/matches/:matchId', ...organizer, validateRequest({ params: validateMatchId }), controller.deleteMatch);
competitionRouter.post('/matches/:matchId/notify', ...organizer, validateRequest({ params: validateMatchId }), controller.notifyMatch);


