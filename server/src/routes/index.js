import { Router } from 'express';
import { healthRouter } from './healthRoutes.js';
import { authRouter } from './authRoutes.js';
import { playerRouter } from './playerRoutes.js';
import { teamRouter } from './teamRoutes.js';
import { registrationRouter, tournamentRouter } from './tournamentRoutes.js';
import { competitionRouter } from './competitionRoutes.js';
import { resultsRouter } from './resultsRoutes.js';
import { archiveRouter } from './archiveRoutes.js';
import { communicationRouter } from './communicationRoutes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/players', playerRouter);
apiRouter.use('/teams', teamRouter);
apiRouter.use('/tournaments', tournamentRouter);
apiRouter.use('/registrations', registrationRouter);
apiRouter.use('/', competitionRouter);
apiRouter.use('/', resultsRouter);
apiRouter.use('/', archiveRouter);
apiRouter.use('/', communicationRouter);
