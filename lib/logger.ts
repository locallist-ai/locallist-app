type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const IS_DEV = __DEV__;

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = IS_DEV ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (shouldLog('debug')) console.log(`[DEBUG] ${message}`, ...args);
  },
  info(message: string, ...args: unknown[]) {
    if (shouldLog('info')) console.log(`[INFO] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    if (shouldLog('warn')) console.warn(`[WARN] ${message}`, ...args);
  },
  error(message: string, error?: unknown, ...args: unknown[]) {
    if (shouldLog('error')) console.error(`[ERROR] ${message}`, error, ...args);
    // Future: Sentry.captureException(error);
  },
};
