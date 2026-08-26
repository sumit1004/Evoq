import { apiClient, normalizeApiError } from './apiClient.js';
async function request(action) { try { return (await action()).data; } catch (error) { throw normalizeApiError(error); } }
export const fetchRounds = (id) => (id ? request(() => apiClient.get(`/tournaments/${id}/rounds`)) : Promise.resolve({ rounds: [] }));
export const getRound = (id) => (id ? request(() => apiClient.get(`/rounds/${id}`)) : Promise.resolve({ round: null }));
export const createRound = (id, input) => request(() => apiClient.post(`/tournaments/${id}/rounds`, input));
export const updateRound = (id, input) => request(() => apiClient.patch(`/rounds/${id}`, input));
export const completeRound = (id) => request(() => apiClient.post(`/rounds/${id}/complete`));
export const deleteRound = (id) => request(() => apiClient.delete(`/rounds/${id}`));
export const fetchGroups = (id) => (id ? request(() => apiClient.get(`/rounds/${id}/groups`)) : Promise.resolve({ groups: [] }));
export const fetchTournamentGroups = (id) => (id ? request(() => apiClient.get(`/tournaments/${id}/groups`)) : Promise.resolve({ groups: [] }));
export const fetchEligibleTeams = (id) => (id ? request(() => apiClient.get(`/rounds/${id}/eligible-teams`)) : Promise.resolve({ teams: [] }));
export const createGroup = (id, input) => request(() => apiClient.post(`/rounds/${id}/groups`, input));
export const fetchGroup = (id) => (id ? request(() => apiClient.get(`/groups/${id}`)) : Promise.resolve({ group: null }));
export const fetchMatch = (id) => (id ? request(() => apiClient.get(`/matches/${id}`)) : Promise.resolve({ match: null }));
export const updateGroup = (id, input) => request(() => apiClient.patch(`/groups/${id}`, input));
export const assignTeam = (groupId, teamId) => request(() => apiClient.post(`/groups/${groupId}/teams/${teamId}`));
export const createMatch = (id, input) => request(() => apiClient.post(`/groups/${id}/matches`, input));
export const updateMatch = (id, input) => request(() => apiClient.patch(`/matches/${id}`, input));
export const completeMatch = (id) => request(() => apiClient.post(`/matches/${id}/complete`));
export async function createResult(matchId, input) {
  if (input.resultMedia instanceof File) {
    const body = new FormData();
    body.append('teamId', input.teamId);
    body.append('points', input.points !== undefined && input.points !== null ? input.points : 0);
    body.append('kills', input.kills !== undefined && input.kills !== null ? input.kills : 0);
    if (input.placement !== '' && input.placement !== undefined && input.placement !== null) {
      body.append('placement', input.placement);
    }
    if (input.resultText) {
      body.append('resultText', input.resultText);
    }
    body.append('resultMedia', input.resultMedia);
    return request(() => apiClient.post(`/matches/${matchId}/results`, body));
  }

  const payload = {
    teamId: Number(input.teamId),
    points: Number(input.points ?? 0),
    kills: Number(input.kills ?? 0),
    placement: input.placement !== '' && input.placement !== undefined && input.placement !== null ? Number(input.placement) : null,
    resultText: input.resultText || null,
  };
  return request(() => apiClient.post(`/matches/${matchId}/results`, payload));
}

export const fetchResults = (matchId) => (matchId ? request(() => apiClient.get(`/matches/${matchId}/results`)) : Promise.resolve({ results: [] }));
export const fetchMatchLeaderboard = (matchId) => (matchId ? request(() => apiClient.get(`/matches/${matchId}/leaderboard`)) : Promise.resolve({ leaderboard: [] }));
export const recalculateLeaderboard = (matchId) => request(() => apiClient.post(`/matches/${matchId}/leaderboard/recalculate`));
export const fetchRoundLeaderboard = (roundId) => (roundId ? request(() => apiClient.get(`/rounds/${roundId}/leaderboard`)) : Promise.resolve({ leaderboard: [] }));
export const fetchTournamentLeaderboard = (tournamentId) => (tournamentId ? request(() => apiClient.get(`/tournaments/${tournamentId}/leaderboards`)) : Promise.resolve({ leaderboard: [] }));
export const fetchQualifications = (roundId) => (roundId ? request(() => apiClient.get(`/rounds/${roundId}/qualifications`)) : Promise.resolve({ qualifications: [] }));
export const selectQualification = (roundId, teamId) => request(() => apiClient.post(`/rounds/${roundId}/qualifications`, { teamId }));
export const removeQualification = (roundId, teamId) => request(() => apiClient.delete(`/rounds/${roundId}/qualifications/${teamId}`));
export const fetchGroupLeaderboard = (groupId) => (groupId ? request(() => apiClient.get(`/groups/${groupId}/leaderboard`)) : Promise.resolve({ leaderboard: [] }));
export const completeGroup = (groupId) => request(() => apiClient.post(`/groups/${groupId}/complete`));
export const removeGroupTeam = (groupId, teamId) => request(() => apiClient.delete(`/groups/${groupId}/teams/${teamId}`));
export const fetchGroupMatches = (groupId) => (groupId ? request(() => apiClient.get(`/groups/${groupId}/matches`)) : Promise.resolve({ matches: [] }));
export const deleteGroup = (groupId) => request(() => apiClient.delete(`/groups/${groupId}`));
export const deleteMatch = (matchId) => request(() => apiClient.delete(`/matches/${matchId}`));
export const notifyMatchSchedule = (matchId) => request(() => apiClient.post(`/matches/${matchId}/notify`));
export const autoAssignGroups = (roundId, input) => request(() => apiClient.post(`/rounds/${roundId}/auto-assign`, input));
export const bulkMoveTeams = (roundId, input) => request(() => apiClient.post(`/rounds/${roundId}/bulk-move`, input));
export const lockRoundAssignment = (roundId) => request(() => apiClient.post(`/rounds/${roundId}/lock`));
export const createNextRound = (tournamentId, input) => request(() => apiClient.post(`/tournaments/${tournamentId}/rounds/next`, input));
export const fetchQualificationCenter = (roundId) => (roundId ? request(() => apiClient.get(`/rounds/${roundId}/qualification-center`)) : Promise.resolve({ groups: [], qualifications: [] }));
export const finalizeQualifications = (roundId, input) => request(() => apiClient.post(`/rounds/${roundId}/qualifications/finalize`, input));
export const reopenQualifications = (roundId) => request(() => apiClient.post(`/rounds/${roundId}/qualifications/reopen`));


