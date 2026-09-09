import { asyncHandler } from '../utils/asyncHandler.js';
import {
  openDirectConversation,
  getConversationsList,
  getConversation,
  getMessagesForConversation,
  sendMessage,
  markAsRead,
} from '../services/directMessageService.js';

export const openConversationController = asyncHandler(async (req, res) => {
  const result = await openDirectConversation(req.user.id, req.body);
  const statusCode = result.isNew ? 201 : 200;
  res.status(statusCode).json(result);
});

export const listConversationsController = asyncHandler(async (req, res) => {
  const conversations = await getConversationsList(req.user.id);
  res.status(200).json({ conversations });
});

export const getConversationController = asyncHandler(async (req, res) => {
  const conversation = await getConversation(req.params.conversationId, req.user.id);
  res.status(200).json({ conversation });
});

export const listMessagesController = asyncHandler(async (req, res) => {
  const data = await getMessagesForConversation(req.params.conversationId, req.user.id, req.query);
  res.status(200).json(data);
});

export const sendMessageController = asyncHandler(async (req, res) => {
  const message = await sendMessage(req.params.conversationId, req.user.id, req.body.message);
  res.status(201).json({ message });
});

export const markAsReadController = asyncHandler(async (req, res) => {
  const result = await markAsRead(req.params.conversationId, req.user.id);
  res.status(200).json(result);
});
