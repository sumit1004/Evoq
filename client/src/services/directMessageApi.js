import { apiClient } from './apiClient.js';

export async function fetchConversations() {
  const { data } = await apiClient.get('/messages/conversations');
  return data.conversations || [];
}

export async function openDirectConversation({ recipientUserId, organizationId, initialMessage }) {
  const { data } = await apiClient.post('/messages/conversations', {
    recipientUserId,
    organizationId,
    initialMessage,
  });
  return data;
}

export async function fetchConversationDetails(conversationId) {
  const { data } = await apiClient.get(`/messages/conversations/${conversationId}`);
  return data.conversation;
}

export async function fetchConversationMessages(conversationId, params = {}) {
  const { data } = await apiClient.get(`/messages/conversations/${conversationId}/messages`, { params });
  return data;
}

export async function sendDirectMessage(conversationId, message) {
  const { data } = await apiClient.post(`/messages/conversations/${conversationId}/messages`, { message });
  return data.message;
}

export async function markConversationRead(conversationId) {
  const { data } = await apiClient.post(`/messages/conversations/${conversationId}/read`);
  return data;
}
