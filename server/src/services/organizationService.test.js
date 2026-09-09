import { describe, expect, it } from 'vitest';
import { validateOrganizationUpdate } from '../validators/organizationValidators.js';

describe('Organization Service & Validators', () => {
  describe('Organization Update Validators', () => {
    it('accepts valid organization update payload', () => {
      const errors = validateOrganizationUpdate({
        name: 'Cloud Esports',
        slug: 'cloud-esports',
        description: 'Competitive tournament host',
        about: 'Founded in 2024 to organize top Free Fire and Valorant tournaments.',
        country: 'India',
        city: 'Delhi',
        foundedYear: 2024,
        websiteUrl: 'https://cloudesports.gg',
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('rejects too short or long organization names', () => {
      const shortErr = validateOrganizationUpdate({ name: 'A' });
      expect(shortErr.name).toBeDefined();

      const longErr = validateOrganizationUpdate({ name: 'A'.repeat(181) });
      expect(longErr.name).toBeDefined();
    });

    it('rejects invalid slug format with spaces or special characters', () => {
      const invalidSlug = validateOrganizationUpdate({ slug: 'My Org!' });
      expect(invalidSlug.slug).toBeDefined();
    });

    it('accepts clean alphanumeric slug with hyphens', () => {
      const validSlug = validateOrganizationUpdate({ slug: 'evoq-gaming-2026' });
      expect(validSlug.slug).toBeUndefined();
    });

    it('rejects invalid founded year', () => {
      const futureYear = validateOrganizationUpdate({ foundedYear: 3000 });
      expect(futureYear.foundedYear).toBeDefined();

      const tooOld = validateOrganizationUpdate({ foundedYear: 1800 });
      expect(tooOld.foundedYear).toBeDefined();
    });
  });
});
