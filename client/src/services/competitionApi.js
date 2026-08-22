import { apiClient, normalizeApiError } from './apiClient.js';
async function request(action) { try { return (await action()).data; } catch (error) { throw normalizeApiError(error); } }
export const fetchRounds = (id) => request(() => apiClient.get(`/tournaments/${id}/rounds`));
export const createRound = (id, input) => request(() => apiClient.post(`/tournaments/${id}/rounds`, input));
export const updateRound = (id, input) => request(() => apiClient.patch(`/rounds/${id}`, input));
export const fetchGroups = (id) => request(() => apiClient.get(`/rounds/${id}/groups`));
export const fetchTournamentGroups = (id) => request(() => apiClient.get(`/tournaments/${id}/groups`));
export const fetchEligibleTeams = (id) => request(() => apiClient.get(`/rounds/${id}/eligible-teams`));
export const createGroup = (id, input) => request(() => apiClient.post(`/rounds/${id}/groups`, input));
export const fetchGroup = (id) => request(() => apiClient.get(`/groups/${id}`));
export const fetchMatch = (id) => request(() => apiClient.get(`/matches/${id}`));
export const updateGroup = (id, input) => request(() => apiClient.patch(`/groups/${id}`, input));
export const assignTeam = (groupId, teamId) => request(() => apiClient.post(`/groups/${groupId}/teams/${teamId}`));
export const createMatch = (id, input) => request(() => apiClient.post(`/groups/${id}/matches`, input));
export const updateMatch = (id, input) => request(() => apiClient.patch(`/matches/${id}`, input));
export const completeMatch = (id) => request(() => apiClient.post(`/matches/${id}/complete`));
export async function createResult(matchId, input) { const body = new FormData(); body.append('teamId', input.teamId); body.append('points', input.points); body.append('kills', input.kills); if (input.placement) body.append('placement', input.placement); if (input.resultText) body.append('resultText', input.resultText); if (input.resultMedia) body.append('resultMedia', input.resultMedia); return request(() => apiClient.post(`/matches/${matchId}/results`, body)); }
export const fetchResults = (matchId) => request(() => apiClient.get(`/matches/${matchId}/results`));
export const fetchMatchLeaderboard = (matchId) => request(() => apiClient.get(`/matches/${matchId}/leaderboard`));
export const recalculateLeaderboard = (matchId) => request(() => apiClient.post(`/matches/${matchId}/leaderboard/recalculate`));
export const fetchRoundLeaderboard = (roundId) => request(() => apiClient.get(`/rounds/${roundId}/leaderboard`));
export const fetchTournamentLeaderboard = (tournamentId) => request(() => apiClient.get(`/tournaments/${tournamentId}/leaderboards`));
export const fetchQualifications = (roundId) => request(() => apiClient.get(`/rounds/${roundId}/qualifications`));
export const selectQualification = (roundId, teamId) => request(() => apiClient.post(`/rounds/${roundId}/qualifications`, { teamId }));
export const removeQualification = (roundId, teamId) => request(() => apiClient.delete(`/rounds/${roundId}/qualifications/${teamId}`));
export const fetchGroupLeaderboard = (groupId) => request(() => apiClient.get(`/groups/${groupId}/leaderboard`));
export const completeGroup = (groupId) => request(() => apiClient.post(`/groups/${groupId}/complete`));
export const removeGroupTeam = (groupId, teamId) => request(() => apiClient.delete(`/groups/${groupId}/teams/${teamId}`));
export const fetchGroupMatches = (groupId) => request(() => apiClient.get(`/groups/${groupId}/matches`));
