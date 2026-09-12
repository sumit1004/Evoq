function write(level, event, details = {}) {
  const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  if (logLevel === 'error' && level !== 'error') return;
  if (logLevel === 'warn' && level !== 'error' && level !== 'warn') return;
  if (logLevel === 'silent' || logLevel === 'none') return;

  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(event, details) {
    write('info', event, details);
  },
  error(event, details) {
    write('error', event, details);
  },
};
