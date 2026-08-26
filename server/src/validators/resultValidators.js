function positiveId(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
export function validateMatchResultParams(params) { return positiveId(params.matchId) ? {} : { matchId: 'matchId must be a positive integer' }; }
export const validateMatchId = validateMatchResultParams;
export function validateTournamentResultsParams(params) { return positiveId(params.tournamentId) ? {} : { tournamentId: 'tournamentId must be a positive integer' }; }
export function validateGroupLeaderboardParams(params) { return positiveId(params.groupId) ? {} : { groupId: 'groupId must be a positive integer' }; }
export function validateRoundLeaderboardParams(params) { return positiveId(params.roundId) ? {} : { roundId: 'roundId must be a positive integer' }; }
export const validateRoundId = validateRoundLeaderboardParams;
export function validateResultCreate(body) {
  const errors = {};
  if (!body || !positiveId(body.teamId)) {
    errors.teamId = 'teamId must be a positive integer';
  }
  if (body?.points === undefined || body?.points === null || body?.points === '' || !Number.isFinite(Number(body.points)) || Number(body.points) < 0) {
    errors.points = 'points must be a non-negative number';
  }
  if (body?.kills === undefined || body?.kills === null || body?.kills === '' || !Number.isInteger(Number(body.kills)) || Number(body.kills) < 0) {
    errors.kills = 'kills must be a non-negative integer';
  }
  if (body?.placement !== undefined && body?.placement !== null && body?.placement !== '' && (!Number.isInteger(Number(body.placement)) || Number(body.placement) < 1)) {
    errors.placement = 'placement must be a positive integer';
  }
  if (body?.resultText !== undefined && body?.resultText !== null && String(body.resultText).length > 5000) {
    errors.resultText = 'resultText must not exceed 5000 characters';
  }
  return errors;
}

export function validateQualificationParams(params) { return { ...(positiveId(params.roundId) ? {} : { roundId: 'roundId must be a positive integer' }), ...(params.teamId === undefined || positiveId(params.teamId) ? {} : { teamId: 'teamId must be a positive integer' }) }; }
export function validateQualificationCreate(body) { return positiveId(body.teamId) ? {} : { teamId: 'teamId must be a positive integer' }; }
