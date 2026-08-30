import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import * as repository from '../repositories/archiveRepository.js';
import { emitRealtime, realtimeRooms } from '../utils/realtimeHub.js';

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function archiveDto(row) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    completedAt: row.completed_at,
    registrationCount: row.registration_count,
    finalLeaderboard: parseJson(row.final_leaderboard_json, []),
    qualifiedTeams: parseJson(row.qualified_teams_json, []),
    winners: parseJson(row.winners_json, []),
    summary: parseJson(row.summary_json, {}),
    createdAt: row.created_at,
  };
}

export async function completeTournament(tournamentId, organizerId) {
  const connection = await (await import('../config/database.js')).pool.getConnection();
  let mediaPaths = [];
  let archiveId = null;
  let finalLeaderboard = [];
  let winners = [];

  try {
    await connection.beginTransaction();

    // 1. Lock and validate tournament
    const tournament = await repository.getTournamentForCompletion(tournamentId, connection);
    if (!tournament || tournament.organizer_id !== organizerId) {
      throw errorResponses.notFound('Tournament not found');
    }

    // 2. Idempotency: if already COMPLETED, safely return the existing archive
    if (tournament.status === 'COMPLETED') {
      const existingArchive = await repository.findArchiveByTournamentId(tournamentId, connection);
      await connection.rollback();
      if (existingArchive) {
        return archiveDto(existingArchive);
      }
      throw errorResponses.conflict('Tournament is already completed');
    }

    if (tournament.status !== 'LIVE') {
      throw errorResponses.conflict('Only LIVE tournaments can be completed');
    }

    // 3. Verify final round completion
    const finalRound = await repository.getFinalRound(tournamentId, connection);
    if (!finalRound || finalRound.status !== 'COMPLETED') {
      throw errorResponses.conflict('The final round must be completed before the tournament');
    }
    if (await repository.countIncompleteGroups(finalRound.id, connection)) {
      throw errorResponses.conflict('Every final-round group must be completed');
    }
    if (await repository.countIncompleteMatches(finalRound.id, connection)) {
      throw errorResponses.conflict('Every final-round match must be completed');
    }

    // 4. Calculate final standings
    finalLeaderboard = await repository.getFinalLeaderboard(tournamentId, connection);
    if (!Array.isArray(finalLeaderboard) || !finalLeaderboard.length) {
      throw errorResponses.conflict('The final leaderboard must contain completed match results');
    }

    // 5. Validate final standings integrity
    for (let i = 0; i < finalLeaderboard.length; i++) {
      const entry = finalLeaderboard[i];
      if (entry.points < 0 || entry.kills < 0) {
        throw errorResponses.conflict('Standings contain invalid negative score values');
      }
      if (!entry.teamName) {
        entry.teamName = `Team ${entry.teamId}`;
      }
    }

    const qualifiedTeams = await repository.getQualifications(tournamentId, connection);
    winners = finalLeaderboard.slice(0, 3);
    const summary = {
      finalRoundId: finalRound.id,
      finalRoundName: finalRound.name,
      matchCount: finalLeaderboard.reduce((sum, entry) => sum + (entry.matchesPlayed || 0), 0),
      winnerTeamId: winners[0]?.teamId || null,
      winnerTeamName: winners[0]?.teamName || null,
      totalRankedTeams: finalLeaderboard.length,
    };

    mediaPaths = await repository.getResultMediaPaths(tournamentId, connection);
    const regCount = await repository.getRegistrationCount(tournamentId, connection);

    // 6. Create immutable tournament history record
    archiveId = await repository.insertArchive({
      tournamentId,
      tournamentName: tournament.name,
      registrationCount: regCount,
      finalLeaderboard,
      qualifiedTeams,
      winners,
      summary,
    }, connection);

    // 7. Verify snapshot was persisted before performing cleanup
    const verified = await repository.findArchive(archiveId, connection);
    if (!verified || !verified.final_leaderboard_json) {
      throw new Error('Failed to verify permanent historical archive snapshot');
    }

    // 8. Safe transient-data cleanup and mark COMPLETED
    await repository.markCompletedAndCleanup(tournamentId, connection);
    await repository.insertCleanupJobs(tournamentId, mediaPaths, connection);

    // 9. Commit transaction
    await connection.commit();

    // 10. Background media cleanup
    await cleanupMedia(tournamentId, mediaPaths);

    // 11. Realtime notification to all connected clients
    emitRealtime(realtimeRooms.tournament(tournamentId), 'tournament_completed', {
      tournamentId: Number(tournamentId),
      status: 'COMPLETED',
      archiveId,
      finalLeaderboard,
      winners,
    });

    return getHistoryById(archiveId);
  } catch (error) {
    await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY') {
      const existing = await repository.findArchiveByTournamentId(tournamentId);
      if (existing) return archiveDto(existing);
      throw errorResponses.conflict('Tournament archive already exists');
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function cleanupMedia(tournamentId, mediaPaths) {
  await Promise.all(mediaPaths.map(async (fileName) => {
    const filePath = path.resolve(config.uploadDirectory, 'match-results', path.basename(fileName));
    try {
      await fs.unlink(filePath);
      await repository.markCleanupFile(tournamentId, fileName, 'COMPLETED');
    } catch (error) {
      await repository.markCleanupFile(tournamentId, fileName, 'FAILED', error.message);
    }
  }));
}

export async function listHistory() {
  return (await repository.listArchives()).map(archiveDto);
}

export async function getHistoryById(historyId) {
  const archive = await repository.findArchive(historyId);
  if (!archive) throw errorResponses.notFound('History entry not found');
  return archiveDto(archive);
}

export async function getArchiveByTournamentId(tournamentId) {
  const archive = await repository.findArchiveByTournamentId(tournamentId);
  if (!archive) throw errorResponses.notFound('Tournament archive not found');
  return archiveDto(archive);
}

export async function deleteHistory(historyId, user) {
  const archive = await repository.findArchive(historyId);
  if (!archive) throw errorResponses.notFound('History entry not found');
  if (user.role !== 'ADMIN' && archive.organizer_id && archive.organizer_id !== user.id) {
    throw errorResponses.forbidden();
  }
  await repository.deleteArchive(historyId);
}
