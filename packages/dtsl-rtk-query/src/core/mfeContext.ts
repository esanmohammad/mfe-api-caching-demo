/**
 * MFE Context Management
 * Handles detection and tracking of which MFE is currently active
 */

// Thread-local storage for current MFE context
let currentMfeContext: string | null = null;

/**
 * Set the current MFE context
 */
export function setMfeContext(mfeName: string | null): void {
  currentMfeContext = mfeName;
}

/**
 * Get the current MFE context
 */
export function getMfeContext(): string | null {
  return currentMfeContext;
}

/**
 * Clear the current MFE context
 */
export function clearMfeContext(): void {
  currentMfeContext = null;
}

/**
 * Auto-detect MFE name from various sources
 * Priority:
 * 1. Explicit context (already set)
 * 2. Module federation container name
 * 3. URL path segment
 * 4. Document title
 * 5. Default fallback
 */
export function detectMfeName(): string {
  // If already set, use that
  if (currentMfeContext) {
    return currentMfeContext;
  }

  // Try to detect from module federation
  const federated = detectFromModuleFederation();
  if (federated) {
    return federated;
  }

  // Try to detect from URL
  const urlBased = detectFromUrl();
  if (urlBased) {
    return urlBased;
  }

  // Try document title
  if (typeof document !== 'undefined' && document.title) {
    return document.title.toLowerCase().replace(/\s+/g, '-').slice(0, 50);
  }

  // Fallback
  return 'unknown-mfe';
}

/**
 * Detect MFE name from Module Federation container
 */
function detectFromModuleFederation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as unknown as Record<string, unknown>;

  // Check for __FEDERATION__ global (common in module federation setups)
  const federation = win.__FEDERATION__;
  if (federation && typeof federation === 'object') {
    const fed = federation as Record<string, unknown>;
    if (typeof fed.name === 'string') {
      return fed.name;
    }
  }

  // Check for __remoteContainer__ (vite-plugin-federation)
  const remoteContainer = win.__remoteContainer__;
  if (remoteContainer && typeof remoteContainer === 'object') {
    const container = remoteContainer as Record<string, unknown>;
    if (typeof container.name === 'string') {
      return container.name;
    }
  }

  return null;
}

/**
 * Detect MFE name from URL path
 * Looks for common patterns like /mfe-profile, /apps/profile, etc.
 */
function detectFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const pathname = window.location.pathname;

  // Pattern: /mfe-{name} or /mfe_{name}
  const mfeMatch = pathname.match(/\/mfe[-_]([^/]+)/);
  if (mfeMatch) {
    return `mfe-${mfeMatch[1]}`;
  }

  // Pattern: /apps/{name}
  const appsMatch = pathname.match(/\/apps\/([^/]+)/);
  if (appsMatch && appsMatch[1]) {
    return appsMatch[1];
  }

  // Pattern: First path segment if it looks like an app name
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  if (firstSegment && /^[a-z][a-z0-9-]*$/i.test(firstSegment)) {
    return firstSegment;
  }

  // Use port number if running on localhost with non-standard port
  const port = window.location.port;
  if (port && port !== '80' && port !== '443') {
    return `app-${port}`;
  }

  return null;
}

/**
 * Check if we're running in an MFE environment
 */
export function isInMfeEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for module federation indicators
  const hasModuleFederation =
    '__FEDERATION__' in window ||
    '__remoteContainer__' in window ||
    '__webpack_share_scopes__' in window;

  // Check for our registry (another MFE already initialized)
  const hasRegistry = '__DTSL_RTK_QUERY_REGISTRY__' in window;

  return hasModuleFederation || hasRegistry;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}
