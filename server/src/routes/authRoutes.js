import { Router } from 'express';
import { loginAccount, signupAccount } from '../controllers/identityController.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { validateLogin, validateSignup } from '../validators/identityValidators.js';
import { authRateLimiter } from '../middleware/securityMiddleware.js';

export const authRouter = Router();

authRouter.post('/signup', authRateLimiter, validateRequest({ body: validateSignup }), signupAccount);
authRouter.post('/login', authRateLimiter, validateRequest({ body: validateLogin }), loginAccount);
