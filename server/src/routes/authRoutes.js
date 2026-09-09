import { Router } from 'express';
import {
  forgotPasswordController,
  getCurrentIdentityController,
  loginAccount,
  resetPasswordController,
  signupAccount,
  validateResetTokenController,
} from '../controllers/identityController.js';
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import {
  validateForgotPassword,
  validateLogin,
  validateResetPassword,
  validateSignup,
} from '../validators/identityValidators.js';
import { authRateLimiter } from '../middleware/securityMiddleware.js';

export const authRouter = Router();

authRouter.post('/signup', authRateLimiter, validateRequest({ body: validateSignup }), signupAccount);
authRouter.post('/login', authRateLimiter, validateRequest({ body: validateLogin }), loginAccount);
authRouter.post('/forgot-password', authRateLimiter, validateRequest({ body: validateForgotPassword }), forgotPasswordController);
authRouter.get('/reset-password/:token', validateResetTokenController);
authRouter.post('/reset-password', authRateLimiter, validateRequest({ body: validateResetPassword }), resetPasswordController);
authRouter.get('/me', authenticateRequest, getCurrentIdentityController);

