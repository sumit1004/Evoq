import { apiClient, normalizeApiError } from './apiClient.js';

export async function requestPasswordResetApi(email) {
  try {
    const { data } = await apiClient.post('/auth/forgot-password', { email });
    return data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function validateResetTokenApi(token) {
  try {
    const { data } = await apiClient.get(`/auth/reset-password/${encodeURIComponent(token)}`);
    return data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function resetPasswordApi({ token, newPassword }) {
  try {
    const { data } = await apiClient.post('/auth/reset-password', {
      token,
      newPassword,
    });
    return data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
