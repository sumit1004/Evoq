import { apiClient, normalizeApiError } from './apiClient.js';
async function request(action) { try { return (await action()).data; } catch (error) { throw normalizeApiError(error); } }
export const completeTournament = (id) => request(() => apiClient.post(`/tournaments/${id}/complete`));
export const fetchHistory = () => request(() => apiClient.get('/history'));
export const fetchHistoryEntry = (id) => request(() => apiClient.get(`/history/${id}`));
export const deleteHistory = (id) => request(() => apiClient.delete(`/history/${id}`));
