export function validateTeamCreate(body = {}) {
  const errors = {};
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) {
    errors.name = 'Team name must be between 2 and 120 characters';
  }
  if (!Array.isArray(body.memberPlayerIds) || body.memberPlayerIds.length > 100) {
    errors.memberPlayerIds = 'memberPlayerIds must be an array with at most 100 entries';
  } else {
    const normalized = body.memberPlayerIds.map((id) => typeof id === 'string' ? id.trim().toUpperCase() : id);
    if (normalized.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 64)) {
      errors.memberPlayerIds = 'Each player ID must be a non-empty string of at most 64 characters';
    } else if (new Set(normalized).size !== normalized.length) {
      errors.memberPlayerIds = 'Player IDs must be unique';
    }
  }
  return errors;
}

export function validateTeamId(params = {}) {
  return /^\d+$/.test(String(params.teamId || '')) && Number(params.teamId) > 0
    ? {}
    : { teamId: 'A positive numeric team ID is required' };
}
