export function validateEsportsProfileUpdate(body = {}) {
  const errors = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) {
      errors.name = 'Display name must be between 2 and 120 characters';
    }
  }

  if (body.country !== undefined && body.country !== null) {
    if (typeof body.country !== 'string' || body.country.length > 100) {
      errors.country = 'Country must be a string up to 100 characters';
    }
  }

  if (body.city !== undefined && body.city !== null) {
    if (typeof body.city !== 'string' || body.city.length > 100) {
      errors.city = 'City must be a string up to 100 characters';
    }
  }

  if (body.bio !== undefined && body.bio !== null) {
    if (typeof body.bio !== 'string' || body.bio.length > 1000) {
      errors.bio = 'Bio must not exceed 1000 characters';
    }
  }

  if (body.avatarUrl !== undefined && body.avatarUrl !== null) {
    if (typeof body.avatarUrl !== 'string' || body.avatarUrl.length > 500) {
      errors.avatarUrl = 'Avatar URL must not exceed 500 characters';
    }
  }

  return errors;
}

export function validateGameProfileCreate(body = {}) {
  const errors = {};

  if (!body.gameName || typeof body.gameName !== 'string' || !body.gameName.trim()) {
    errors.gameName = 'Game name is required';
  } else if (body.gameName.trim().length > 120) {
    errors.gameName = 'Game name must not exceed 120 characters';
  }

  if (!body.inGameName || typeof body.inGameName !== 'string' || !body.inGameName.trim()) {
    errors.inGameName = 'In-game name (IGN) is required';
  } else if (body.inGameName.trim().length > 120) {
    errors.inGameName = 'In-game name must not exceed 120 characters';
  }

  if (!body.gameUid || typeof body.gameUid !== 'string' || !body.gameUid.trim()) {
    errors.gameUid = 'Game UID is required';
  } else if (body.gameUid.trim().length > 120) {
    errors.gameUid = 'Game UID must not exceed 120 characters';
  }

  if (!body.primaryRole || typeof body.primaryRole !== 'string' || !body.primaryRole.trim()) {
    errors.primaryRole = 'Primary esports role is required';
  } else if (body.primaryRole.trim().length > 60) {
    errors.primaryRole = 'Primary role must not exceed 60 characters';
  }

  if (body.secondaryRole && typeof body.secondaryRole === 'string' && body.secondaryRole.trim().length > 60) {
    errors.secondaryRole = 'Secondary role must not exceed 60 characters';
  }

  if (body.startedPlayingAt) {
    const d = new Date(body.startedPlayingAt);
    if (isNaN(d.getTime())) {
      errors.startedPlayingAt = 'Started playing date must be a valid date';
    }
  }

  return errors;
}

export function validateGameProfileUpdate(body = {}) {
  const errors = {};

  if (body.gameName !== undefined) {
    if (typeof body.gameName !== 'string' || !body.gameName.trim() || body.gameName.trim().length > 120) {
      errors.gameName = 'Game name must be 1-120 characters';
    }
  }

  if (body.inGameName !== undefined) {
    if (typeof body.inGameName !== 'string' || !body.inGameName.trim() || body.inGameName.trim().length > 120) {
      errors.inGameName = 'In-game name must be 1-120 characters';
    }
  }

  if (body.gameUid !== undefined) {
    if (typeof body.gameUid !== 'string' || !body.gameUid.trim() || body.gameUid.trim().length > 120) {
      errors.gameUid = 'Game UID must be 1-120 characters';
    }
  }

  if (body.primaryRole !== undefined) {
    if (typeof body.primaryRole !== 'string' || !body.primaryRole.trim() || body.primaryRole.trim().length > 60) {
      errors.primaryRole = 'Primary role must be 1-60 characters';
    }
  }

  if (body.startedPlayingAt) {
    const d = new Date(body.startedPlayingAt);
    if (isNaN(d.getTime())) {
      errors.startedPlayingAt = 'Started playing date must be a valid date';
    }
  }

  return errors;
}

export function validatePracticeSessionCreate(body = {}) {
  const errors = {};

  if (!body.sessionDate || isNaN(new Date(body.sessionDate).getTime())) {
    errors.sessionDate = 'Valid session date is required';
  }

  if (!body.gameName || typeof body.gameName !== 'string' || !body.gameName.trim()) {
    errors.gameName = 'Game name is required';
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.title = 'Session title / lobby name is required';
  } else if (body.title.trim().length > 180) {
    errors.title = 'Session title must not exceed 180 characters';
  }

  if (body.notes && typeof body.notes === 'string' && body.notes.length > 1000) {
    errors.notes = 'Notes must not exceed 1000 characters';
  }

  return errors;
}

export function validatePracticeSessionUpdate(body = {}) {
  const errors = {};

  if (body.sessionDate !== undefined && isNaN(new Date(body.sessionDate).getTime())) {
    errors.sessionDate = 'Session date must be a valid date';
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 180) {
      errors.title = 'Session title must be 1-180 characters';
    }
  }

  return errors;
}

export function validatePracticeMatchInput(body = {}) {
  const errors = {};

  if (body.placement !== undefined && body.placement !== null && body.placement !== '') {
    const p = Number(body.placement);
    if (!Number.isInteger(p) || p < 1 || p > 100) {
      errors.placement = 'Placement must be an integer between 1 and 100';
    }
  }

  if (body.kills !== undefined && body.kills !== null) {
    const k = Number(body.kills);
    if (!Number.isInteger(k) || k < 0 || k > 500) {
      errors.kills = 'Kills must be a non-negative integer';
    }
  }

  if (body.damage !== undefined && body.damage !== null) {
    const d = Number(body.damage);
    if (!Number.isInteger(d) || d < 0) {
      errors.damage = 'Damage must be a non-negative integer';
    }
  }

  if (body.assists !== undefined && body.assists !== null) {
    const a = Number(body.assists);
    if (!Number.isInteger(a) || a < 0) {
      errors.assists = 'Assists must be a non-negative integer';
    }
  }

  if (body.score !== undefined && body.score !== null) {
    const s = Number(body.score);
    if (isNaN(s) || s < 0) {
      errors.score = 'Score must be a non-negative number';
    }
  }

  return errors;
}
