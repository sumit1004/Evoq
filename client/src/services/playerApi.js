import { apiClient, normalizeApiError } from './apiClient.js';
export async function fetchPlayerDashboard() { try { return (await apiClient.get('/players/dashboard')).data.dashboard; } catch (error) { throw normalizeApiError(error); } }
