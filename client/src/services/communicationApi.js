import { apiClient, normalizeApiError } from './apiClient.js';
async function request(action) { try { return (await action()).data; } catch (error) { throw normalizeApiError(error); } }
export const fetchAnnouncements = (id) => request(() => apiClient.get(`/tournaments/${id}/announcements`));
export const createAnnouncement = (id, message) => request(() => apiClient.post(`/tournaments/${id}/announcements`, { message }));
export const fetchChat = (id) => request(() => apiClient.get(`/groups/${id}/chat`));
export const createChat = (id, message) => request(() => apiClient.post(`/groups/${id}/chat`, { message }));
export const fetchNotifications = () => request(() => apiClient.get('/notifications'));
export const markNotificationRead = (id) => request(() => apiClient.post(`/notifications/${id}/read`));
export const markAllNotificationsRead = () => request(() => apiClient.post('/notifications/read-all'));
