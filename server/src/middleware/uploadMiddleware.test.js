import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { uploadResultMedia, uploadTeamLogo } from './uploadMiddleware.js';
import { config } from '../config/env.js';

describe('Upload Security & Magic-Byte Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTestApp() {
    const app = express();
    app.post('/test-upload', uploadResultMedia, (req, res) => {
      res.status(200).json({ success: true, filename: req.file?.filename });
    });
    app.post('/test-logo', uploadTeamLogo, (req, res) => {
      res.status(200).json({ success: true, filename: req.file?.filename });
    });
    // Error handler
    app.use((err, _req, res, _next) => {
      res.status(err.status || 400).json({
        error: { code: err.code || 'UPLOAD_ERROR', message: err.message },
      });
    });
    return app;
  }

  it('accepts valid PNG image with proper magic bytes', async () => {
    const app = createTestApp();
    // Genuine PNG header bytes: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

    const res = await request(app)
      .post('/test-upload')
      .attach('resultMedia', validPngBuffer, { filename: 'valid.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts valid JPEG image with proper magic bytes', async () => {
    const app = createTestApp();
    // Genuine JPEG header bytes: FF D8 FF
    const validJpgBuffer = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);

    const res = await request(app)
      .post('/test-upload')
      .attach('resultMedia', validJpgBuffer, { filename: 'valid.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects spoofed image file with text/executable content claiming to be PNG', async () => {
    const app = createTestApp();
    // Text content pretending to be PNG
    const fakeBuffer = Buffer.from('<?php echo "malicious payload"; ?>');

    const res = await request(app)
      .post('/test-upload')
      .attach('resultMedia', fakeBuffer, { filename: 'exploit.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UPLOAD_VALIDATION_ERROR');
    expect(res.body.error.message).toContain('not a valid supported image');
  });

  it('rejects forbidden file extensions like .exe or .sh', async () => {
    const app = createTestApp();
    const exeBuffer = Buffer.from('MZ...fake-binary');

    const res = await request(app)
      .post('/test-upload')
      .attach('resultMedia', exeBuffer, { filename: 'trojan.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
  });
});
