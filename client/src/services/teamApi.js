import { apiClient, normalizeApiError } from './apiClient.js';

export async function fetchTeams() {
  try {
    const { data } = await apiClient.get('/teams');
    return data.teams;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function createTeam(input) {
  try {
    const { data } = await apiClient.post('/teams', input);
    return data.team;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function removeTeam(teamId) {
  try {
    await apiClient.delete(`/teams/${teamId}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
