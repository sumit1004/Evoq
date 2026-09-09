export function validateCreateConversation(body = {}) {
  const errors = {};

  if (!body.recipientUserId && !body.organizationId) {
    errors.target = 'Either recipientUserId or organizationId is required to start a conversation';
  }

  if (body.recipientUserId !== undefined && body.recipientUserId !== null) {
    const id = Number(body.recipientUserId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      errors.recipientUserId = 'Invalid recipient user ID';
    }
  }

  if (body.organizationId !== undefined && body.organizationId !== null) {
    const id = Number(body.organizationId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      errors.organizationId = 'Invalid organization ID';
    }
  }

  if (body.initialMessage !== undefined && body.initialMessage !== null) {
    if (typeof body.initialMessage !== 'string' || body.initialMessage.trim().length === 0) {
      errors.initialMessage = 'Initial message cannot be empty';
    } else if (body.initialMessage.length > 2000) {
      errors.initialMessage = 'Message must not exceed 2000 characters';
    }
  }

  return errors;
}

export function validateSendMessage(body = {}) {
  const errors = {};

  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    errors.message = 'Message content is required';
  } else if (body.message.length > 2000) {
    errors.message = 'Message must not exceed 2000 characters';
  }

  return errors;
}
