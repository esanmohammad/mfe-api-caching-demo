/**
 * Logger
 *
 * Thin logging wrapper so the library doesn't spam the console in production.
 *
 * - `debug` is silent in production builds and can be toggled at runtime.
 * - `warn` / `error` always fire — they signal real misconfiguration the
 *   developer needs to see (config divergence, endpoint collisions, etc.).
 */

const PREFIX = '[federated-query]';

/**
 * Detect a production build without assuming `process` exists (browser/SSR safe).
 */
function isProductionBuild(): boolean {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process;
    return proc?.env?.NODE_ENV === 'production';
  } catch {
    return false;
  }
}

// Debug logging is on outside production by default; can be toggled at runtime.
let debugEnabled = !isProductionBuild();

/**
 * Enable or disable verbose debug logging at runtime.
 * Useful for diagnosing cache/invalidation behavior in a deployed app.
 */
export function setDebugLogging(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Whether debug logging is currently enabled.
 */
export function isDebugLogging(): boolean {
  return debugEnabled;
}

export const logger = {
  debug(...args: unknown[]): void {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.debug(PREFIX, ...args);
    }
  },
  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(PREFIX, ...args);
  },
};
