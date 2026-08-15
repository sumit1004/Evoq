import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { registerSocketHandlers } from './sockets/index.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    credentials: true,
  },
});

registerSocketHandlers(io);

server.listen(config.port, () => {
  logger.info('server_started', {
    port: config.port,
    environment: config.nodeEnv,
  });
});
