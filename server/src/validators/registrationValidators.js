export function validateRegistrationCreate(body = {}) {
  const errors = {};
  if (!Number.isInteger(Number(body.teamId)) || Number(body.teamId) < 1) errors.teamId = 'A valid team ID is required';
  if (body.transactionId !== undefined && typeof body.transactionId !== 'string') errors.transactionId = 'Transaction ID must be text';
  return errors;
}

export function validateRegistrationReview(body = {}) {
  const errors = {};
  if (!['VERIFIED', 'REJECTED'].includes(body.status)) errors.status = 'Status must be VERIFIED or REJECTED';
  if (body.status === 'REJECTED' && (typeof body.rejectionReason !== 'string' || body.rejectionReason.trim().length < 3)) errors.rejectionReason = 'A rejection reason is required';
  return errors;
}

export function validateRegistrationId(params = {}) {
  return /^\d+$/.test(String(params.registrationId || '')) && Number(params.registrationId) > 0 ? {} : { registrationId: 'A positive numeric registration ID is required' };
}
