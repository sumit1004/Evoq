import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getPlayerEsportsProfile,
  updatePlayerEsportsProfile,
  addGameProfileForPlayer,
  editGameProfileForPlayer,
  removeGameProfileForPlayer,
  getPublicEsportsProfile,
  searchPlayersByEvoqId,
} from '../services/playerPerformanceService.js';
import {
  listGameProfiles,
  listPracticeSessions,
  findPracticeSessionById,
  createPracticeSession,
  updatePracticeSession,
  deletePracticeSession,
  listPracticeMatches,
  createPracticeMatch,
  updatePracticeMatch,
  deletePracticeMatch,
  getOfficialTournamentHistory,
  getOfficialMatchResults,
} from '../repositories/playerProfileRepository.js';
import { errorResponses } from '../errors/AppError.js';

export const getMyEsportsProfileController = asyncHandler(async (req, res) => {
  const profile = await getPlayerEsportsProfile(req.user.id);
  res.status(200).json({ profile });
});

export const updateMyEsportsProfileController = asyncHandler(async (req, res) => {
  const profile = await updatePlayerEsportsProfile(req.user.id, req.body);
  res.status(200).json({ profile });
});

export const listGameProfilesController = asyncHandler(async (req, res) => {
  const games = await listGameProfiles(req.user.id);
  res.status(200).json({ games });
});

export const createGameProfileController = asyncHandler(async (req, res) => {
  const game = await addGameProfileForPlayer(req.user.id, req.body);
  res.status(201).json({ game });
});

export const updateGameProfileController = asyncHandler(async (req, res) => {
  const game = await editGameProfileForPlayer(req.user.id, req.params.gameId, req.body);
  res.status(200).json({ game });
});

export const deleteGameProfileController = asyncHandler(async (req, res) => {
  const result = await removeGameProfileForPlayer(req.user.id, req.params.gameId);
  res.status(200).json(result);
});

// Practice Sessions
export const listPracticeSessionsController = asyncHandler(async (req, res) => {
  const data = await listPracticeSessions(req.user.id, req.query);
  res.status(200).json(data);
});

export const getPracticeSessionController = asyncHandler(async (req, res) => {
  const session = await findPracticeSessionById(req.user.id, req.params.sessionId);
  if (!session) {
    throw errorResponses.notFound('Practice session not found');
  }
  res.status(200).json({ session });
});

export const createPracticeSessionController = asyncHandler(async (req, res) => {
  const sessionId = await createPracticeSession(req.user.id, req.body);
  const session = await findPracticeSessionById(req.user.id, sessionId);
  res.status(201).json({ session });
});

export const updatePracticeSessionController = asyncHandler(async (req, res) => {
  const updated = await updatePracticeSession(req.user.id, req.params.sessionId, req.body);
  if (!updated) {
    throw errorResponses.notFound('Practice session not found');
  }
  const session = await findPracticeSessionById(req.user.id, req.params.sessionId);
  res.status(200).json({ session });
});

export const deletePracticeSessionController = asyncHandler(async (req, res) => {
  const deleted = await deletePracticeSession(req.user.id, req.params.sessionId);
  if (!deleted) {
    throw errorResponses.notFound('Practice session not found');
  }
  res.status(200).json({ success: true });
});

// Practice Matches
export const listPracticeMatchesController = asyncHandler(async (req, res) => {
  const data = await listPracticeMatches(req.user.id, req.query);
  res.status(200).json(data);
});

export const createPracticeMatchController = asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  if (!sessionId) {
    throw errorResponses.validation({ sessionId: 'Practice session ID is required' });
  }
  const matchId = await createPracticeMatch(req.user.id, { ...req.body, sessionId });
  res.status(201).json({ matchId, success: true });
});

export const updatePracticeMatchController = asyncHandler(async (req, res) => {
  const updated = await updatePracticeMatch(req.user.id, req.params.matchId, req.body);
  if (!updated) {
    throw errorResponses.notFound('Practice match not found');
  }
  res.status(200).json({ success: true });
});

export const deletePracticeMatchController = asyncHandler(async (req, res) => {
  const deleted = await deletePracticeMatch(req.user.id, req.params.matchId);
  if (!deleted) {
    throw errorResponses.notFound('Practice match not found');
  }
  res.status(200).json({ success: true });
});

// Official Tournament & Match History
export const getPlayerTournamentHistoryController = asyncHandler(async (req, res) => {
  const tournaments = await getOfficialTournamentHistory(req.user.id);
  res.status(200).json({ tournaments });
});

export const getPlayerMatchHistoryController = asyncHandler(async (req, res) => {
  const { type = 'ALL', game, startDate, endDate, limit = 20, offset = 0 } = req.query;

  let officialMatches = [];
  let practiceMatches = [];
  let totalOfficial = 0;
  let totalPractice = 0;

  if (type === 'ALL' || type === 'OFFICIAL') {
    const resOff = await getOfficialMatchResults(req.user.id, { game, startDate, endDate, limit: 100 });
    officialMatches = resOff.matches;
    totalOfficial = resOff.total;
  }

  if (type === 'ALL' || type === 'PRACTICE') {
    const resPrac = await listPracticeMatches(req.user.id, { game, startDate, endDate, limit: 100 });
    practiceMatches = resPrac.matches.map((m) => ({
      id: m.id,
      sessionId: m.session_id,
      sessionTitle: m.session_title,
      teamName: m.team_name,
      gameName: m.game_name,
      matchNumber: m.match_number,
      placement: m.placement,
      kills: m.kills,
      assists: m.assists,
      damage: m.damage,
      score: m.score,
      playedAt: m.played_at,
      source: 'PLAYER_REPORTED',
    }));
    totalPractice = resPrac.total;
  }

  // Combine and sort chronologically
  const combined = [...officialMatches, ...practiceMatches].sort((a, b) => {
    return new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
  });

  const paginated = combined.slice(Number(offset), Number(offset) + Number(limit));

  res.status(200).json({
    matches: paginated,
    total: totalOfficial + totalPractice,
    officialCount: totalOfficial,
    practiceCount: totalPractice,
  });
});

// Public Player Search & Profile
export const searchPlayerController = asyncHandler(async (req, res) => {
  const query = req.query.query || req.query.q || '';
  const players = await searchPlayersByEvoqId(query);
  res.status(200).json({ players });
});

export const getPublicPlayerProfileController = asyncHandler(async (req, res) => {
  const profile = await getPublicEsportsProfile(req.params.evoqId);
  res.status(200).json({ profile });
});
