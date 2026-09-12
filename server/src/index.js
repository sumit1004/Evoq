import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { pingDatabase, pool } from './config/database.js';
import { runMigrations } from './database/migrationRunner.js';
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

export async function startServer(options = {}) {
  const port = options.port !== undefined ? options.port : config.port;
  const host = options.host || config.host || '0.0.0.0';

  logger.info('server_bootstrapping', {
    service: 'EVOQ API',
    port,
    host,
    environment: config.nodeEnv,
  });

  // Step 1: Verify database connectivity BEFORE opening HTTP port
  const dbCheck = await pingDatabase(5000);
  if (!dbCheck.ok) {
    const errorMsg = 'EVOQ database connection unavailable. Ensure MySQL is running on configured host and port.';
    logger.error('database_connection_unavailable', {
      message: errorMsg,
      error: dbCheck.error,
    });
    throw new Error(errorMsg);
  }
  logger.info('bootstrap_step', { step: 'database_ready', status: 'connected' });

  // Step 2: Apply any pending migrations
  try {
    const migrationRes = await runMigrations();
    if (migrationRes.applied?.length) {
      logger.info('migrations_applied', { applied: migrationRes.applied });
    }
  } catch (migErr) {
    logger.error('migrations_failed', { message: migErr.message, stack: migErr.stack });
    throw migErr;
  }
  logger.info('bootstrap_step', { step: 'migrations_ready' });

  // Step 3: Initialize Express Application
  const app = createApp();

  // Step 4: Create HTTP Server and configure keep-alive timeouts
  const server = http.createServer(app);

  // Keep-alive timeouts tuned for reverse proxies (Vite proxy, Nginx, cloud ALBs)
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // Step 5: Initialize Socket.IO
  const allowedOrigins = Array.from(
    new Set([
      config.clientOrigin,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ].filter(Boolean))
  );

  const io = new Server(server, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });
  registerSocketHandlers(io);
  logger.info('bootstrap_step', { step: 'socket_io_ready' });

  // Step 6: Attach Server Error Handlers
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error('server_port_in_use', {
        port,
        message: `Port ${port} is already in use. Please terminate existing process or configure a different PORT.`,
      });
      process.exit(1);
    }
    logger.error('server_error', { message: error.message, code: error.code });
  });

  // Step 7: Listen on configured host and port only when ALL dependencies are fully initialized
  await new Promise((resolve, reject) => {
    const listenErrorListener = (err) => {
      server.removeListener('listening', listenSuccessListener);
      reject(err);
    };
    const listenSuccessListener = () => {
      server.removeListener('error', listenErrorListener);
      resolve();
    };
    server.once('error', listenErrorListener);
    server.once('listening', listenSuccessListener);
    server.listen(port, host);
  });

  logger.info('server_started', {
    service: 'EVOQ API',
    port,
    host,
    database: 'connected',
    socketIO: 'ready',
    environment: config.nodeEnv,
  });

  let isShuttingDown = false;
  async function shutdown(signal = 'MANUAL', options = {}) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    const closePool = options.closePool ?? (signal === 'SIGTERM' || signal === 'SIGINT');

    logger.info('server_shutdown_started', { signal });

    const forceTimer = setTimeout(() => {
      logger.error('server_shutdown_forced', { signal });
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    return new Promise((resolve) => {
      server.close(async () => {
        if (closePool) {
          try {
            await pool.end();
          } catch {
            // Ignore pool closing errors during process termination
          }
        }
        clearTimeout(forceTimer);
        logger.info('server_shutdown_complete', { signal });
        resolve();
      });
    });
  }

  const actualPort = server.address()?.port || port;
  const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${actualPort}`;

  return { app, server, io, port: actualPort, url, shutdown };
}

let activeInstance = null;

async function handleSignal(signal) {
  if (activeInstance) {
    await activeInstance.shutdown(signal);
    process.exit(0);
  }
}

process.once('SIGTERM', () => handleSignal('SIGTERM'));
process.once('SIGINT', () => handleSignal('SIGINT'));

// Auto-start when run directly via node / node --watch
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectExecution || (!process.env.VITEST && process.env.NODE_ENV !== 'test')) {
  startServer()
    .then((instance) => {
      activeInstance = instance;
    })
    .catch((error) => {
      logger.error('server_bootstrap_fatal', { message: error.message, stack: error.stack });
      process.exit(1);
    });
}
