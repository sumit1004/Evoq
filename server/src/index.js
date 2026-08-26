import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { pingDatabase, pool } from './config/database.js';
import { registerSocketHandlers } from './sockets/index.js';
import { logger } from './utils/logger.js';

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', {
    message: error?.message || 'Uncaught exception occurred',
    stack: error?.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    credentials: true,
  },
});

registerSocketHandlers(io);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error('server_port_in_use', {
      port: config.port,
      message: `Port ${config.port} is already in use. Please terminate existing process or configure a different PORT.`,
    });
    process.exit(1);
  }
  logger.error('server_error', { message: error.message, code: error.code });
});

server.listen(config.port, async () => {
  const dbCheck = await pingDatabase(3000);
  const dbStatus = dbCheck.ok ? 'connected' : 'unavailable';

  logger.info('server_started', {
    service: 'EVOQ API',
    port: config.port,
    database: dbStatus,
    socketIO: 'ready',
    environment: config.nodeEnv,
  });

  if (!dbCheck.ok) {
    logger.error('database_connection_unavailable', {
      message: 'EVOQ database connection unavailable. Ensure MySQL is running on configured host and port.',
    });
  }
});

let isShuttingDown = false;
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('server_shutdown_started', { signal });

  const forceTimer = setTimeout(() => {
    logger.error('server_shutdown_forced', { signal });
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await pool.end();
    } catch {
      // Ignore pool closing errors during process termination
    }
    clearTimeout(forceTimer);
    logger.info('server_shutdown_complete', { signal });
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

