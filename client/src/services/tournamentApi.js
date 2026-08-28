import { apiClient, normalizeApiError } from './apiClient.js';

async function request(action) {
  try { return (await action()).data; } catch (error) { throw normalizeApiError(error); }
}

export const fetchTournaments = (params = {}) => request(() => apiClient.get('/tournaments', { params }));
export const fetchOrganizerTournaments = () => request(() => apiClient.get('/tournaments?scope=mine'));
export const fetchTournament = (id) => request(() => apiClient.get(`/tournaments/${id}`));
export const fetchRegistrations = (id, params = {}) => request(() => apiClient.get(`/tournaments/${id}/registrations`, { params }));
export async function createTournament(input) {
  const hasFile = Object.values(input).some(val => val instanceof File);
  if (hasFile) {
    const body = new FormData();
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined && val !== null) body.append(key, val);
    }
    return request(() => apiClient.post('/tournaments', body));
  }
  return request(() => apiClient.post('/tournaments', input));
}

export async function updateTournament(id, input) {
  const hasFile = Object.values(input).some(val => val instanceof File);
  if (hasFile) {
    const body = new FormData();
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined && val !== null) body.append(key, val);
    }
    return request(() => apiClient.patch(`/tournaments/${id}`, body));
  }
  return request(() => apiClient.patch(`/tournaments/${id}`, input));
}
export const deleteTournament = (id) => request(() => apiClient.delete(`/tournaments/${id}`));
export const fetchScoringConfig = (tournamentId) => request(() => apiClient.get(`/tournaments/${tournamentId}/scoring-config`));
export const updateScoringConfig = (tournamentId, input) => request(() => apiClient.put(`/tournaments/${tournamentId}/scoring-config`, input));
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

export const bulkVerifyRegistrations = (registrationIds) => request(() => apiClient.post('/registrations/bulk-verify', { registrationIds }));
export const bulkRejectRegistrations = (registrationIds, rejectionReason) => request(() => apiClient.post('/registrations/bulk-reject', { registrationIds, rejectionReason }));
export const fetchPaymentSummary = (tournamentId) => request(() => apiClient.get(`/tournaments/${tournamentId}/payment-summary`));
export const fetchTournamentAccess = (tournamentId) => request(() => apiClient.get(`/tournaments/${tournamentId}/access`));

