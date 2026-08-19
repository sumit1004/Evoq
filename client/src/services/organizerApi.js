import { apiClient } from './apiClient.js';

export async function fetchOrganizerDashboard() {
  const { data } = await apiClient.get('/organizer/dashboard');
  return data.dashboard;
}
