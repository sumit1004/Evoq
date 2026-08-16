import { apiClient, normalizeApiError } from './apiClient.js';

async function request(action) {
  try { return (await action()).data; } catch (error) { throw normalizeApiError(error); }
}

export const fetchTournaments = () => request(() => apiClient.get('/tournaments'));
export const fetchOrganizerTournaments = () => request(() => apiClient.get('/tournaments?scope=mine'));
export const fetchTournament = (id) => request(() => apiClient.get(`/tournaments/${id}`));
export const fetchRegistrations = (id, params = {}) => request(() => apiClient.get(`/tournaments/${id}/registrations`, { params }));
export const createTournament = (input) => request(() => apiClient.post('/tournaments', input));
export const updateTournament = (id, input) => request(() => apiClient.patch(`/tournaments/${id}`, input));
export const reviewRegistration = (id, input) => request(() => apiClient.patch(`/registrations/${id}`, input));
export async function downloadRegistrationWorkbook(tournamentId) { try { return (await apiClient.get(`/tournaments/${tournamentId}/registrations/export.xlsx`, { responseType: 'blob' })).data; } catch (error) { throw normalizeApiError(error); } }

export async function registerTeam(tournamentId, input) {
  const body = new FormData();
  body.append('teamId', input.teamId);
  if (input.transactionId) body.append('transactionId', input.transactionId);
  if (input.paymentScreenshot) body.append('paymentScreenshot', input.paymentScreenshot);
  return request(() => apiClient.post(`/tournaments/${tournamentId}/registrations`, body));
}

export async function downloadPaymentEvidence(registrationId) {
  try { return (await apiClient.get(`/registrations/${registrationId}/payment-evidence`, { responseType: 'blob' })).data; }
  catch (error) { throw normalizeApiError(error); }
}
