import { errorResponses } from '../errors/AppError.js';
import {
  findOrCreateDirectConversation,
  isConversationParticipant,
  getConversationById,
  listUserConversations,
  listMessages,
  createDirectMessage,
  markConversationAsRead,
  getConversationRecipients,
} from '../repositories/directMessageRepository.js';
import { findOrganizationById } from '../repositories/staffRepository.js';
import { pool } from '../config/database.js';
import { emitRealtime, realtimeRooms } from '../utils/realtimeHub.js';

// Rate limiter per user (sliding window)
const userMessageTimestamps = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = userMessageTimestamps.get(userId) || [];
  const valid = timestamps.filter((t) => now - t < 10_000); // 10s window

  if (valid.length >= 30) {
    throw errorResponses.badRequest('Too many messages sent. Please slow down.');
  }

  valid.push(now);
  userMessageTimestamps.set(userId, valid);
}

/**
 * Initiates or opens an existing direct conversation between two users or with an organization.
 */
export async function openDirectConversation(senderId, { recipientUserId, organizationId, initialMessage }) {
  let targetUserId = recipientUserId ? Number(recipientUserId) : null;
  let orgId = organizationId ? Number(organizationId) : null;

  if (orgId) {
    const org = await findOrganizationById(orgId);
    if (!org) {
      throw errorResponses.notFound('Organization not found');
    }
    targetUserId = Number(org.owner_id);
  }

  if (!targetUserId) {
    throw errorResponses.badRequest('Recipient user or organization is required');
  }

  if (Number(senderId) === targetUserId) {
    throw errorResponses.badRequest('You cannot start a direct conversation with yourself');
  }

  // Ensure recipient user exists
  const [userCheck] = await pool.query('SELECT id, name, role FROM users WHERE id = ?', [targetUserId]);
  if (!userCheck[0]) {
    throw errorResponses.notFound('Recipient user not found');
  }

  const { conversation, isNew } = await findOrCreateDirectConversation(senderId, targetUserId, orgId);

  let firstMessage = null;
  if (initialMessage && initialMessage.trim()) {
    checkRateLimit(senderId);
    firstMessage = await createDirectMessage(conversation.id, senderId, initialMessage);

    // Realtime notification to recipient user room
    emitRealtime(realtimeRooms.user(targetUserId), 'direct_message', {
      ...firstMessage,
      conversationId: conversation.id,
      organizationId: orgId,
    });
  }

  const detailedConversation = await getConversationById(conversation.id, senderId);

  return {
    conversation: detailedConversation,
    isNew,
    initialMessage: firstMessage,
  };
}

/**
 * Returns all active direct conversations for a user.
 */
export async function getConversationsList(userId) {
  return listUserConversations(userId);
}

/**
 * Returns conversation details ensuring participant access.
 */
export async function getConversation(conversationId, userId) {
  const isParticipant = await isConversationParticipant(conversationId, userId);
  if (!isParticipant) {
    throw errorResponses.forbidden('You do not have access to this conversation');
  }

  const conversation = await getConversationById(conversationId, userId);
  if (!conversation) {
    throw errorResponses.notFound('Conversation not found');
  }

  return conversation;
}

/**
 * Returns paginated messages for a conversation.
 */
export async function getMessagesForConversation(conversationId, userId, options = {}) {
  const isParticipant = await isConversationParticipant(conversationId, userId);
  if (!isParticipant) {
    throw errorResponses.forbidden('You do not have access to this conversation');
  }

  return listMessages(conversationId, options);
}

/**
 * Sends a message within an existing conversation, persists it, and emits to recipient in realtime.
 */
export async function sendMessage(conversationId, senderId, messageText) {
  const isParticipant = await isConversationParticipant(conversationId, senderId);
  if (!isParticipant) {
    throw errorResponses.forbidden('You are not a participant in this conversation');
  }

  checkRateLimit(senderId);

  const message = await createDirectMessage(conversationId, senderId, messageText);
  const recipients = await getConversationRecipients(conversationId, senderId);

  // Emit event to all other participants' user-specific socket rooms
  for (const recipientId of recipients) {
    emitRealtime(realtimeRooms.user(recipientId), 'direct_message', message);
  }

  return message;
}

/**
 * Marks conversation messages as read.
 */
export async function markAsRead(conversationId, userId) {
  const isParticipant = await isConversationParticipant(conversationId, userId);
  if (!isParticipant) {
    throw errorResponses.forbidden('You do not have access to this conversation');
  }

  await markConversationAsRead(conversationId, userId);

  // Notify sender that their messages were read
  const recipients = await getConversationRecipients(conversationId, userId);
  for (const recipientId of recipients) {
    emitRealtime(realtimeRooms.user(recipientId), 'direct_message_read', {
      conversationId: Number(conversationId),
      readByUserId: Number(userId),
      readAt: new Date(),
    });
  }

  return { success: true };
}
