import { describe, expect, it } from 'vitest';
import {
  hasAllowedImageSignature,
  generateMediaKey,
  getPublicMediaUrl,
} from './mediaService.js';

describe('MediaService', () => {
  it('detects PNG magic bytes correctly', async () => {
    const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    const isValid = await hasAllowedImageSignature(pngBuffer, 'image/png');
    expect(isValid).toBe(true);

    const invalidPng = await hasAllowedImageSignature(Buffer.from([0, 1, 2, 3, 4]), 'image/png');
    expect(invalidPng).toBe(false);
  });

  it('detects JPEG magic bytes correctly', async () => {
    const jpegBuffer = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);
    const isValid = await hasAllowedImageSignature(jpegBuffer, 'image/jpeg');
    expect(isValid).toBe(true);

    const invalidJpeg = await hasAllowedImageSignature(Buffer.from([0, 1, 2, 3, 4]), 'image/jpeg');
    expect(invalidJpeg).toBe(false);
  });

  it('detects WEBP magic bytes correctly', async () => {
    const webpBuffer = Buffer.from('RIFF1234WEBPVP8 ');
    const isValid = await hasAllowedImageSignature(webpBuffer, 'image/webp');
    expect(isValid).toBe(true);

    const invalidWebp = await hasAllowedImageSignature(Buffer.from('RIFF1234AVI '), 'image/webp');
    expect(invalidWebp).toBe(false);
  });

  it('generates secure keys with sanitized categories and random UUIDs', () => {
    const key = generateMediaKey({ category: 'teams', entityId: 10, type: 'logo', ext: 'webp' });
    expect(key).toMatch(/^teams\/10\/logo\/[a-f0-9-]+\.webp$/);

    const orgKey = generateMediaKey({ category: 'organizations', entityId: 'org-123', type: 'banner', ext: 'png' });
    expect(orgKey).toMatch(/^organizations\/org-123\/banner\/[a-f0-9-]+\.png$/);
  });

  it('formats public media URLs cleanly', () => {
    expect(getPublicMediaUrl(null)).toBeNull();
    expect(getPublicMediaUrl('teams/10/logo/abc.webp')).toBe('/api/media/teams/10/logo/abc.webp');
    expect(getPublicMediaUrl('https://s3.amazonaws.com/bucket/key.webp')).toBe('https://s3.amazonaws.com/bucket/key.webp');
  });
});
