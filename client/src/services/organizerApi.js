import { apiClient, normalizeApiError } from './apiClient.js';

export async function fetchOrganizerDashboard() {
  try {
    const { data } = await apiClient.get('/organizer/dashboard');
    return data.dashboard;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

