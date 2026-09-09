import { Router } from 'express';
import {
  openConversationController,
  listConversationsController,
  getConversationController,
  listMessagesController,
  sendMessageController,
  markAsReadController,
} from '../controllers/directMessageController.js';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import {
  validateCreateConversation,
  validateSendMessage,
} from '../validators/directMessageValidators.js';

export const directMessageRouter = Router();

// All direct message endpoints require authentication
directMessageRouter.use(authenticateRequest);

// Conversations
directMessageRouter.get('/conversations', listConversationsController);
directMessageRouter.post(
  '/conversations',
  validateRequest({ body: validateCreateConversation }),
  openConversationController,
);
directMessageRouter.get('/conversations/:conversationId', getConversationController);

// Messages in conversation
directMessageRouter.get('/conversations/:conversationId/messages', listMessagesController);
directMessageRouter.post(
  '/conversations/:conversationId/messages',
  validateRequest({ body: validateSendMessage }),
  sendMessageController,
);
directMessageRouter.post('/conversations/:conversationId/read', markAsReadController);
