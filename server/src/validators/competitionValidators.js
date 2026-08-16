function positiveInteger(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
function idParams(params, name) { return positiveInteger(params[name]) ? {} : { [name]: `${name} must be a positive integer` }; }

export function validateTournamentRoundId(params) { return idParams(params, 'tournamentId'); }
export function validateRoundId(params) { return idParams(params, 'roundId'); }
export function validateGroupId(params) { return idParams(params, 'groupId'); }
export function validateMatchId(params) { return idParams(params, 'matchId'); }
export function validateGroupTeamParams(params) {
  return { ...idParams(params, 'groupId'), ...idParams(params, 'teamId') };
}

export function validateRoundCreate(body) {
  const errors = {};
  if (!positiveInteger(body.roundNumber)) errors.roundNumber = 'roundNumber must be a positive integer';
  if (!body.name || body.name.trim().length < 2 || body.name.trim().length > 120) errors.name = 'name must be 2 to 120 characters';
  return errors;
}

export function validateGroupCreate(body) {
  const errors = {};
  if (!body.name || body.name.trim().length < 2 || body.name.trim().length > 120) errors.name = 'name must be 2 to 120 characters';
  if (!positiveInteger(body.groupSize)) errors.groupSize = 'groupSize must be a positive integer';
  return errors;
}

export function validateGroupPatch(body) {
  const errors = {};
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120)) errors.name = 'name must be 2 to 120 characters';
  if (body.groupSize !== undefined && !positiveInteger(body.groupSize)) errors.groupSize = 'groupSize must be a positive integer';
  if (body.status !== undefined && !['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(body.status)) errors.status = 'Invalid group status';
  return errors;
}

export function validateMatchCreate(body) {
  const errors = {};
  if (!positiveInteger(body.matchNumber)) errors.matchNumber = 'matchNumber must be a positive integer';
  if (!body.name || body.name.trim().length < 2 || body.name.trim().length > 120) errors.name = 'name must be 2 to 120 characters';
  if (body.scheduledAt !== undefined && body.scheduledAt !== null && Number.isNaN(Date.parse(body.scheduledAt))) errors.scheduledAt = 'scheduledAt must be a valid date';
  return errors;
}

export function validateMatchPatch(body) {
  const errors = {};
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120)) errors.name = 'name must be 2 to 120 characters';
  if (body.status !== undefined && !['SCHEDULED', 'LIVE', 'COMPLETED'].includes(body.status)) errors.status = 'Invalid match status';
  if (body.scheduledAt !== undefined && body.scheduledAt !== null && Number.isNaN(Date.parse(body.scheduledAt))) errors.scheduledAt = 'scheduledAt must be a valid date';
  return errors;
}
