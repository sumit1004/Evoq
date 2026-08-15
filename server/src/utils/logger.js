function write(level, event, details = {}) {
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
