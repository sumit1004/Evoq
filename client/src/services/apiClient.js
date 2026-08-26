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
  if (!error.response) {
    return {
      message: 'Server is temporarily unavailable. Please check your connection and try again.',
      code: 'SERVER_UNAVAILABLE',
      status: 503,
    };
  }

  let responseData = error.response.data;
  if (typeof responseData === 'string') {
    try {
      responseData = JSON.parse(responseData);
    } catch {
      responseData = {};
    }
  }

  const payload = responseData?.error;
  const status = error.response.status;

  let message = payload?.message;
  if (!message) {
    if (status === 503 || payload?.code === 'DATABASE_UNAVAILABLE') {
      message = 'The EVOQ database is temporarily unavailable. Please try again later.';
    } else if (status === 502 || status === 504) {
      message = 'Server is temporarily unavailable. Please retry in a moment.';
    } else {
      message = error.response.statusText || 'The request could not be completed.';
    }
  }

  return {
    message,
    code: payload?.code || (status >= 500 ? 'SERVER_ERROR' : undefined),
    details: payload?.details,
    status,
  };
}

