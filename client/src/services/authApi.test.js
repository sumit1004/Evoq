import { describe, expect, it, vi } from 'vitest';
import {
  requestPasswordResetApi,
  resetPasswordApi,
  validateResetTokenApi,
} from './authApi.js';
import { apiClient } from './apiClient.js';

describe('authApi', () => {
  it('calls POST /auth/forgot-password with email', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { message: 'Password reset link sent.' },
    });

    const result = await requestPasswordResetApi('user@example.com');
    expect(postSpy).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'user@example.com',
    });
    expect(result.message).toBe('Password reset link sent.');
  });

  it('calls GET /auth/reset-password/:token', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { valid: true, email: 'u***@example.com' },
    });

    const result = await validateResetTokenApi('abc123token');
    expect(getSpy).toHaveBeenCalledWith('/auth/reset-password/abc123token');
    expect(result.valid).toBe(true);
    expect(result.email).toBe('u***@example.com');
  });

  it('calls POST /auth/reset-password with token and newPassword', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { message: 'Password has been reset successfully.' },
    });

    const result = await resetPasswordApi({
      token: 'abc123token',
      newPassword: 'MyNewPassword123!',
    });
    expect(postSpy).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'abc123token',
      newPassword: 'MyNewPassword123!',
    });
    expect(result.message).toBe('Password has been reset successfully.');
  });
});
