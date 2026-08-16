export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorResponses = {
  authenticationRequired: () => new AppError('Authentication is required', {
    status: 401,
    code: 'AUTHENTICATION_REQUIRED',
  }),
  invalidToken: () => new AppError('The access token is invalid or expired', {
    status: 401,
    code: 'INVALID_TOKEN',
  }),
  forbidden: () => new AppError('You do not have permission to perform this action', {
    status: 403,
    code: 'FORBIDDEN',
  }),
  validation: (details) => new AppError('Validation failed', {
    status: 400,
    code: 'VALIDATION_ERROR',
    details,
  }),
  conflict: (message) => new AppError(message, {
    status: 409,
    code: 'CONFLICT',
  }),
  notFound: (message) => new AppError(message, {
    status: 404,
    code: 'NOT_FOUND',
  }),
  invalidCredentials: () => new AppError('Invalid email or password', {
    status: 401,
    code: 'INVALID_CREDENTIALS',
  }),
};
