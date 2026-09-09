import { asyncHandler } from '../utils/asyncHandler.js';
import { getCurrentIdentity, login, signup, updateCurrentProfile } from '../services/identityService.js';
import {
  requestPasswordReset,
  resetPassword,
  validateResetToken,
} from '../services/passwordResetService.js';
import { getPlayerDashboard } from '../services/playerDashboardService.js';

export const signupAccount = asyncHandler(async (req, res) => {
  const result = await signup(req.body);
  res.status(201).json(result);
});

export const loginAccount = asyncHandler(async (req, res) => {
  const result = await login(req.body);
  res.status(200).json(result);
});

export const forgotPasswordController = asyncHandler(async (req, res) => {
  const result = await requestPasswordReset(req.body.email);
  res.status(200).json(result);
});

export const validateResetTokenController = asyncHandler(async (req, res) => {
  const result = await validateResetToken(req.params.token);
  res.status(200).json(result);
});

export const resetPasswordController = asyncHandler(async (req, res) => {
  const result = await resetPassword({
    token: req.body.token,
    newPassword: req.body.newPassword,
  });
  res.status(200).json(result);
});

export const getCurrentIdentityController = asyncHandler(async (req, res) => {
  res.status(200).json({ identity: await getCurrentIdentity(req.user.id) });
});

export const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ identity: await getCurrentIdentity(req.user.id) });
});

export const patchMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ identity: await updateCurrentProfile(req.user.id, req.body) });
});

export const getPlayerDashboardController = asyncHandler(async (req, res) => res.status(200).json({ dashboard: await getPlayerDashboard(req.user.id) }));

