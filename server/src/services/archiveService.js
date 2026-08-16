import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { errorResponses } from '../errors/AppError.js';
import * as repository from '../repositories/archiveRepository.js';

function parseJson(value, fallback) { if (value && typeof value === 'object') return value; try { return JSON.parse(value); } catch { return fallback; } }
function archiveDto(row) { return { id: row.id, tournamentId: row.tournament_id, tournamentName: row.tournament_name, completedAt: row.completed_at, registrationCount: row.registration_count, finalLeaderboard: parseJson(row.final_leaderboard_json, []), qualifiedTeams: parseJson(row.qualified_teams_json, []), winners: parseJson(row.winners_json, []), summary: parseJson(row.summary_json, {}), createdAt: row.created_at }; }

export async function completeTournament(tournamentId, organizerId) {
  const connection = await (await import('../config/database.js')).pool.getConnection();
  let mediaPaths = [];
  try {
    await connection.beginTransaction();
    const tournament = await repository.getTournamentForCompletion(tournamentId, connection);
    if (!tournament || tournament.organizer_id !== organizerId) throw errorResponses.notFound('Tournament not found');
    if (tournament.status === 'COMPLETED') throw errorResponses.conflict('Tournament is already completed');
    if (tournament.status !== 'LIVE') throw errorResponses.conflict('Only LIVE tournaments can be completed');
    const finalRound = await repository.getFinalRound(tournamentId, connection);
    if (!finalRound || finalRound.status !== 'COMPLETED') throw errorResponses.conflict('The final round must be completed before the tournament');
    if (await repository.countIncompleteGroups(finalRound.id, connection)) throw errorResponses.conflict('Every final-round group must be completed');
    if (await repository.countIncompleteMatches(finalRound.id, connection)) throw errorResponses.conflict('Every final-round match must be completed');
    if (!(await repository.countQualifications(finalRound.id, connection))) throw errorResponses.conflict('Final qualification decisions must be finalized');
    const finalLeaderboard = await repository.getFinalLeaderboard(tournamentId, connection);
    if (!finalLeaderboard.length) throw errorResponses.conflict('The final leaderboard must be finalized');
    const qualifiedTeams = await repository.getQualifications(tournamentId, connection);
    const winners = finalLeaderboard.slice(0, 3);
    const summary = { finalRoundId: finalRound.id, finalRoundName: finalRound.name, matchCount: finalLeaderboard.reduce((sum, entry) => sum + entry.matchesPlayed, 0), winnerTeamId: winners[0]?.teamId || null };
    mediaPaths = await repository.getResultMediaPaths(tournamentId, connection);
    const archiveId = await repository.insertArchive({ tournamentId, tournamentName: tournament.name, registrationCount: await repository.getRegistrationCount(tournamentId, connection), finalLeaderboard, qualifiedTeams, winners, summary }, connection);
    await repository.markCompletedAndCleanup(tournamentId, connection);
    await repository.insertCleanupJobs(tournamentId, mediaPaths, connection);
    await connection.commit();
    await cleanupMedia(tournamentId, mediaPaths);
    return getHistoryById(archiveId);
  } catch (error) { await connection.rollback(); if (error?.code === 'ER_DUP_ENTRY') throw errorResponses.conflict('Tournament archive already exists'); throw error; } finally { connection.release(); }
}

async function cleanupMedia(tournamentId, mediaPaths) { await Promise.all(mediaPaths.map(async (fileName) => { const filePath = path.resolve(config.uploadDirectory, 'match-results', path.basename(fileName)); try { await fs.unlink(filePath); await repository.markCleanupFile(tournamentId, fileName, 'COMPLETED'); } catch (error) { await repository.markCleanupFile(tournamentId, fileName, 'FAILED', error.message); } })); }
export async function listHistory() { return (await repository.listArchives()).map(archiveDto); }
export async function getHistoryById(historyId) { const archive = await repository.findArchive(historyId); if (!archive) throw errorResponses.notFound('History entry not found'); return archiveDto(archive); }
export async function deleteHistory(historyId, user) { const archive = await repository.findArchive(historyId); if (!archive) throw errorResponses.notFound('History entry not found'); if (user.role !== 'ADMIN' && archive.organizer_id && archive.organizer_id !== user.id) throw errorResponses.forbidden(); await repository.deleteArchive(historyId); }
