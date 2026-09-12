import { Router } from 'express';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/authorizationMiddleware.js';
import { mutationRateLimiter } from '../middleware/securityMiddleware.js';
import { connectPaymentAccount, deletePaymentAccount, getPaymentAccount, getTournamentPaymentSummary } from '../controllers/paymentController.js';

export const paymentRouter = Router();

paymentRouter.get('/organizer/payment-account', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), getPaymentAccount);
paymentRouter.post('/organizer/payment-account/connect', mutationRateLimiter, authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), connectPaymentAccount);
paymentRouter.delete('/organizer/payment-account', mutationRateLimiter, authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), deletePaymentAccount);

paymentRouter.get('/tournaments/:tournamentId/payment-summary', authenticateRequest, requireRoles('ORGANIZER', 'ADMIN'), getTournamentPaymentSummary);
