import { apiClient, normalizeApiError } from './apiClient.js';

async function request(call) {
  try {
    const response = await call();
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

// Organizer Scout Endpoints
export const searchScouts = (query, tournamentId) =>
  request(() => apiClient.get('/organizer/scouts/search', { params: { query, tournamentId } }));

export const fetchTournamentStaff = (tournamentId) =>
  request(() => apiClient.get(`/tournaments/${tournamentId}/staff`));

export const assignTournamentStaff = (tournamentId, input) =>
  request(() => apiClient.post(`/tournaments/${tournamentId}/staff`, input));

export const updateTournamentStaff = (tournamentId, staffId, input) =>
  request(() => apiClient.put(`/tournaments/${tournamentId}/staff/${staffId}`, input));

export const revokeTournamentStaff = (tournamentId, staffId) =>
  request(() => apiClient.delete(`/tournaments/${tournamentId}/staff/${staffId}`));

export const fetchStaffAuditLogs = (tournamentId, params = {}) =>
  request(() => apiClient.get(`/tournaments/${tournamentId}/staff/audit-logs`, { params }));

// Scout Workspace Endpoints
export const fetchScoutAssignedTournaments = () =>
  request(() => apiClient.get('/scout/tournaments'));

export const fetchScoutTournamentWorkspace = (tournamentId) =>
  request(() => apiClient.get(`/scout/tournaments/${tournamentId}`));

export const fetchScoutGroupWorkspace = (tournamentId, groupId) =>
  request(() => apiClient.get(`/scout/tournaments/${tournamentId}/groups/${groupId}`));
