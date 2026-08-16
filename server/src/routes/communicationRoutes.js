import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import * as controller from '../controllers/communicationController.js';
import { validateAnnouncementId, validateGroupId, validateMessage, validateNotificationId, validateTournamentId } from '../validators/communicationValidators.js';
import { chatRateLimiter, mutationRateLimiter } from '../middleware/securityMiddleware.js';

const authenticated = [authenticateRequest, requireRoles('PLAYER', 'ORGANIZER', 'ADMIN')];
const organizer = [authenticateRequest, requireRoles('ORGANIZER', 'ADMIN')];
export const communicationRouter = Router();
communicationRouter.get('/tournaments/:tournamentId/announcements', ...authenticated, validateRequest({ params: validateTournamentId }), controller.listAnnouncements);
communicationRouter.post('/tournaments/:tournamentId/announcements', mutationRateLimiter, ...organizer, validateRequest({ params: validateTournamentId, body: validateMessage }), controller.createAnnouncement);
communicationRouter.delete('/announcements/:announcementId', ...organizer, validateRequest({ params: validateAnnouncementId }), controller.deleteAnnouncement);
communicationRouter.get('/notifications', ...authenticated, controller.listNotifications);
communicationRouter.post('/notifications/:notificationId/read', ...authenticated, validateRequest({ params: validateNotificationId }), controller.markNotificationRead);
communicationRouter.post('/notifications/read-all', ...authenticated, controller.markAllNotificationsRead);
communicationRouter.get('/groups/:groupId/chat', ...authenticated, validateRequest({ params: validateGroupId }), controller.listChat);
communicationRouter.post('/groups/:groupId/chat', chatRateLimiter, ...authenticated, validateRequest({ params: validateGroupId, body: validateMessage }), controller.createChat);
