const statuses = new Set(['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'LIVE']);

function validDate(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }

export function validateTournamentCreate(body = {}) {
  const errors = {};
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 180) errors.name = 'Name must be between 2 and 180 characters';
  if (!validDate(body.registrationStartAt)) errors.registrationStartAt = 'A valid registration start date is required';
  if (!validDate(body.registrationEndAt)) errors.registrationEndAt = 'A valid registration end date is required';
  if (validDate(body.registrationStartAt) && validDate(body.registrationEndAt) && new Date(body.registrationEndAt) <= new Date(body.registrationStartAt)) errors.registrationEndAt = 'Registration end must be after registration start';
  if (body.tournamentDate !== undefined && body.tournamentDate !== null && !validDate(body.tournamentDate)) errors.tournamentDate = 'Tournament date must be valid';
  if (!Number.isInteger(Number(body.maxTeams)) || Number(body.maxTeams) < 1) errors.maxTeams = 'maxTeams must be a positive integer';
  if (!Number.isInteger(Number(body.playersPerTeam)) || Number(body.playersPerTeam) < 1) errors.playersPerTeam = 'playersPerTeam must be a positive integer';
  if (!['FREE', 'PAID'].includes(body.entryType)) errors.entryType = 'Entry type must be FREE or PAID';
  if (body.entryType === 'PAID' && Number(body.entryFee) <= 0) errors.entryFee = 'Paid tournaments require a positive entry fee';
  if (body.entryType === 'FREE' && Number(body.entryFee || 0) !== 0) errors.entryFee = 'Free tournaments must have a zero entry fee';
  if (body.prizes !== undefined && (!Array.isArray(body.prizes) || body.prizes.some((prize) => !Number.isInteger(Number(prize.position)) || Number(prize.position) < 1 || Number(prize.amount) < 0))) errors.prizes = 'Prizes must contain positive positions and non-negative amounts';
  return errors;
}

export function validateTournamentPatch(body = {}) {
  const errors = {};
  if (body.status !== undefined && !statuses.has(body.status)) errors.status = 'Invalid tournament lifecycle status';
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 180)) errors.name = 'Name must be between 2 and 180 characters';
  return errors;
}

export function validateTournamentId(params = {}) {
  return /^\d+$/.test(String(params.tournamentId || '')) && Number(params.tournamentId) > 0 ? {} : { tournamentId: 'A positive numeric tournament ID is required' };
}
