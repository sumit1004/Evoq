import { errorResponses } from '../errors/AppError.js';
import * as scoringRepo from '../repositories/scoringRepository.js';

export const DEFAULT_POSITION_POINTS = Object.freeze([
  { position: 1, points: 12 },
  { position: 2, points: 9 },
  { position: 3, points: 8 },
  { position: 4, points: 7 },
  { position: 5, points: 6 },
  { position: 6, points: 5 },
  { position: 7, points: 4 },
  { position: 8, points: 3 },
  { position: 9, points: 2 },
  { position: 10, points: 1 },
  { position: 11, points: 0 },
  { position: 12, points: 0 },
]);

export async function getTournamentScoringConfig(tournamentId) {
  const context = await scoringRepo.getTournamentContext(tournamentId);
  if (!context) throw errorResponses.notFound('Tournament not found');

  const config = await scoringRepo.findScoringConfig(tournamentId);
  const posRows = await scoringRepo.listPositionPoints(tournamentId);

  if (!config) {
    return {
      tournamentId: Number(tournamentId),
      scoringMode: 'KILLS_AND_POSITION',
      killPointsPerKill: 1,
      positionPoints: DEFAULT_POSITION_POINTS.map((p) => ({ ...p })),
    };
  }

  const positionPoints = posRows.length > 0
    ? posRows.map((r) => ({ position: Number(r.position), points: Number(r.points) }))
    : DEFAULT_POSITION_POINTS.map((p) => ({ ...p }));

  return {
    tournamentId: Number(tournamentId),
    scoringMode: config.scoring_mode,
    killPointsPerKill: Number(config.kill_points_per_kill),
    positionPoints,
    createdAt: config.created_at,
    updatedAt: config.updated_at,
  };
}

export async function updateTournamentScoringConfig(tournamentId, input, userId) {
  const context = await scoringRepo.getTournamentContext(tournamentId);
  if (!context || context.organizer_id !== userId) {
    throw errorResponses.notFound('Tournament not found');
  }
  if (context.status === 'COMPLETED') {
    throw errorResponses.conflict('Completed tournaments are read-only');
  }

  const scoringMode = input.scoringMode || 'KILLS_AND_POSITION';
  if (scoringMode !== 'KILLS_AND_POSITION' && scoringMode !== 'TOTAL_SCORE') {
    throw errorResponses.validation({ scoringMode: 'Invalid scoring mode' });
  }

  const killPointsPerKill = input.killPointsPerKill !== undefined ? Number(input.killPointsPerKill) : 1;
  if (isNaN(killPointsPerKill) || killPointsPerKill < 0) {
    throw errorResponses.validation({ killPointsPerKill: 'Kill points must be a non-negative number' });
  }

  const rawPositions = Array.isArray(input.positionPoints) ? input.positionPoints : DEFAULT_POSITION_POINTS;
  const positionPoints = [];
  const seenPositions = new Set();

  for (const item of rawPositions) {
    const position = Number(item.position);
    const points = Number(item.points);

    if (!Number.isInteger(position) || position < 1) {
      throw errorResponses.validation({ positionPoints: `Position must be a positive integer: ${item.position}` });
    }
    if (isNaN(points) || points < 0) {
      throw errorResponses.validation({ positionPoints: `Points for position ${position} cannot be negative` });
    }
    if (seenPositions.has(position)) {
      throw errorResponses.validation({ positionPoints: `Duplicate position configuration: ${position}` });
    }

    seenPositions.add(position);
    positionPoints.push({ position, points });
  }

  positionPoints.sort((a, b) => a.position - b.position);

  await scoringRepo.saveScoringConfig(tournamentId, {
    scoringMode,
    killPointsPerKill,
    positionPoints,
  });

  return getTournamentScoringConfig(tournamentId);
}

export function calculateMatchTeamScore(scoringConfig, input) {
  if (scoringConfig.scoringMode === 'TOTAL_SCORE') {
    const rawScore = input.points !== undefined && input.points !== null && input.points !== ''
      ? input.points
      : input.totalScore;
    const totalPoints = Number(rawScore);
    if (isNaN(totalPoints) || totalPoints < 0) {
      throw errorResponses.validation({ points: 'Total score must be a non-negative number' });
    }
    return {
      kills: 0,
      placement: null,
      killPoints: 0,
      positionPoints: 0,
      totalPoints,
    };
  }

  // KILLS_AND_POSITION Mode
  const kills = Number(input.kills ?? 0);
  if (isNaN(kills) || kills < 0 || !Number.isInteger(kills)) {
    throw errorResponses.validation({ kills: 'Kills must be a non-negative integer' });
  }

  const placement = input.placement !== undefined && input.placement !== null && input.placement !== ''
    ? Number(input.placement)
    : null;

  if (placement === null || isNaN(placement) || placement < 1 || !Number.isInteger(placement)) {
    throw errorResponses.validation({ placement: 'Position must be a positive integer' });
  }

  const posConfig = scoringConfig.positionPoints.find((p) => p.position === placement);
  if (!posConfig) {
    throw errorResponses.validation({
      placement: `Position ${placement} is not configured for this tournament.`,
    });
  }

  const killPoints = kills * Number(scoringConfig.killPointsPerKill);
  const positionPoints = Number(posConfig.points);
  const totalPoints = killPoints + positionPoints;

  return {
    kills,
    placement,
    killPoints,
    positionPoints,
    totalPoints,
  };
}
