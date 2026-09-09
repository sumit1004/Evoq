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

export async function uploadOrgLogoApi(file) {
  const formData = new FormData();
  formData.append('logo', file);
  const { data } = await apiClient.post('/organizations/me/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.organization;
}

export async function deleteOrgLogoApi() {
  const { data } = await apiClient.delete('/organizations/me/logo');
  return data.organization;
}

export async function uploadOrgBannerApi(file) {
  const formData = new FormData();
  formData.append('banner', file);
  const { data } = await apiClient.post('/organizations/me/banner', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.organization;
}

export async function deleteOrgBannerApi() {
  const { data } = await apiClient.delete('/organizations/me/banner');
  return data.organization;
}

