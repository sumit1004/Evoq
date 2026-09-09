import { Router } from 'express';
import { serveMediaFile } from '../controllers/mediaController.js';

export const mediaRouter = Router();

// Match any media path under /api/media/*
mediaRouter.get('/*', serveMediaFile);
