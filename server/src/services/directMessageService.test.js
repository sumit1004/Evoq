import { describe, expect, it } from 'vitest';
import {
  validateCreateConversation,
  validateSendMessage,
} from '../validators/directMessageValidators.js';

describe('Direct Message Service & Validators', () => {
  describe('Direct Message Validators', () => {
    it('rejects empty payload on create conversation', () => {
      const errors = validateCreateConversation({});
      expect(errors.target).toBeDefined();
    });

    it('accepts valid recipient user ID', () => {
      const errors = validateCreateConversation({ recipientUserId: 5 });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('accepts valid organization ID', () => {
      const errors = validateCreateConversation({ organizationId: 2 });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('rejects negative or invalid recipient IDs', () => {
      const errors = validateCreateConversation({ recipientUserId: -1 });
      expect(errors.recipientUserId).toBeDefined();
    });

    it('rejects empty message on send', () => {
      const errors = validateSendMessage({ message: '   ' });
      expect(errors.message).toBeDefined();
    });

    it('rejects message exceeding 2000 characters', () => {
      const longMsg = 'a'.repeat(2001);
      const errors = validateSendMessage({ message: longMsg });
      expect(errors.message).toBeDefined();
    });

    it('accepts valid message content', () => {
      const errors = validateSendMessage({ message: 'Hello, looking forward to competing!' });
      expect(Object.keys(errors).length).toBe(0);
    });
  });
});
