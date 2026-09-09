import { apiClient } from './apiClient.js';

export async function fetchPublicOrganizations(params = {}) {
  const { data } = await apiClient.get('/organizations', { params });
  return data;
}

export async function fetchPublicOrganizationProfile(idOrSlug) {
  const { data } = await apiClient.get(`/organizations/${idOrSlug}`);
  return data.organization;
}

export async function fetchOrganizationTournaments(idOrSlug, params = {}) {
  const { data } = await apiClient.get(`/organizations/${idOrSlug}/tournaments`, { params });
  return data;
}

export async function fetchMyOrganization() {
  const { data } = await apiClient.get('/organizations/me/profile');
  return data.organization;
}

export async function updateMyOrganization(updates) {
  const { data } = await apiClient.put('/organizations/me/profile', updates);
  return data.organization;
}
