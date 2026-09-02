function logToConsole(level, event, ctx) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...ctx,
  };
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  write(JSON.stringify(line));
}

const log = {
  info: (event, ctx) => logToConsole('info', event, ctx),
  warn: (event, ctx) => logToConsole('warn', event, ctx),
  error: (event, ctx) => logToConsole('error', event, ctx),
};

module.exports = { log };
