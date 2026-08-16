import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('evoq.accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function normalizeApiError(error) {
  if (!error.response) return { message: 'Unable to reach EVOQ. Check your connection and try again.' };
  let responseData = error.response.data;
  if (typeof responseData === 'string') {
    try { responseData = JSON.parse(responseData); } catch { responseData = {}; }
  }
  const payload = responseData?.error;
  return {
    message: payload?.message || (payload?.code === 'DATABASE_UNAVAILABLE'
      ? 'EVOQ is temporarily unavailable. Please try again later.'
      : error.response.statusText || 'The request could not be completed.'),
    code: payload?.code,
    details: payload?.details,
    status: error.response.status,
  };
}
