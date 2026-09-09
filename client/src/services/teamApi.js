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

export async function uploadTeamLogoApi(teamId, file) {
  try {
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await apiClient.post(`/teams/${teamId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.team;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function deleteTeamLogoApi(teamId) {
  try {
    const { data } = await apiClient.delete(`/teams/${teamId}/logo`);
    return data.team;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

