/**
 * URL-Based Auto-Invalidation Manager
 *
 * Automatically invalidates queries based on mutation URL patterns,
 * eliminating the need for cross-MFE tag coordination.
 *
 * How it works:
 * 1. When a query is made, its URL pattern is registered
 * 2. When a mutation completes, matching queries are automatically invalidated
 * 3. Pattern matching follows REST conventions (e.g., DELETE /users/123 invalidates /users/*)
 */

export interface UrlPattern {
  /** Original URL or pattern */
  url: string;
  /** HTTP method */
  method: string;
  /** Normalized pattern for matching (e.g., /users/:id) */
  pattern: string;
  /** Base resource path (e.g., /users) */
  basePath: string;
  /** Endpoint name for this query */
  endpointName: string;
  /** Reducer path of the API */
  reducerPath: string;
  /** Timestamp when registered */
  timestamp: number;
}

export interface InvalidationRule {
  /** Mutation method (POST, PUT, PATCH, DELETE) */
  method: string;
  /** URL pattern to match */
  pattern: string | RegExp;
  /** Custom handler to determine which queries to invalidate */
  invalidate?: (
    mutationUrl: string,
    registeredQueries: UrlPattern[],
  ) => string[];
}

/**
 * Cross-resource invalidation mapping
 * When a mutation matches the source pattern, invalidate queries matching target patterns
 */
export interface CrossResourceInvalidation {
  /** Source URL pattern (supports wildcards: * for any segment, ** for any path) */
  source: string;
  /** HTTP methods to match (default: all mutation methods) */
  methods?: string[];
  /** Target URL patterns to invalidate */
  invalidates: string[];
}

export interface UrlInvalidationOptions {
  /** Enable automatic REST-based invalidation @default true */
  enableAutoInvalidation?: boolean;
  /** Custom invalidation rules */
  customRules?: InvalidationRule[];
  /** Cross-resource invalidation mappings */
  crossResourceInvalidations?: CrossResourceInvalidation[];
  /** Log invalidation events @default false */
  debug?: boolean;
}

/**
 * Manages URL-based cache invalidation across MFEs
 */
export class UrlInvalidationManager {
  private queryRegistry: Map<string, UrlPattern> = new Map();
  private customRules: InvalidationRule[] = [];
  private crossResourceMappings: CrossResourceInvalidation[] = [];
  private debug: boolean = false;
  private enableAutoInvalidation: boolean = true;

  constructor(options: UrlInvalidationOptions = {}) {
    this.enableAutoInvalidation = options.enableAutoInvalidation ?? true;
    this.customRules = options.customRules ?? [];
    this.crossResourceMappings = options.crossResourceInvalidations ?? [];
    this.debug = options.debug ?? false;
  }

  /**
   * Register a query URL for potential invalidation
   */
  registerQuery(
    endpointName: string,
    url: string,
    method: string = "GET",
    reducerPath: string,
  ): void {
    const pattern = this.normalizeUrl(url);
    const basePath = this.extractBasePath(url);

    // Use URL + reducerPath as key to allow same URL from different APIs
    const registryKey = `${reducerPath}:${url}`;

    this.queryRegistry.set(registryKey, {
      url,
      method,
      pattern,
      basePath,
      endpointName,
      reducerPath,
      timestamp: Date.now(),
    });

    if (this.debug) {
      console.debug(
        `[@dtsl/rtk-query] Registered query: ${method} ${url} -> endpoint: ${endpointName}`,
      );
    }
  }

  /**
   * Unregister a query when it's removed from cache
   */
  unregisterQuery(cacheKey: string): void {
    this.queryRegistry.delete(cacheKey);
  }

  /**
   * Find queries to invalidate based on a mutation
   * Returns endpoint names that should be refetched
   */
  findQueriesToInvalidate(
    mutationUrl: string,
    mutationMethod: string,
    reducerPath: string,
  ): string[] {
    const endpointsToInvalidate: Set<string> = new Set();

    // Check custom rules first
    for (const rule of this.customRules) {
      if (rule.method.toUpperCase() !== mutationMethod.toUpperCase()) {
        continue;
      }

      const matches =
        typeof rule.pattern === "string"
          ? mutationUrl.includes(rule.pattern)
          : rule.pattern.test(mutationUrl);

      if (matches && rule.invalidate) {
        const queries = Array.from(this.queryRegistry.values()).filter(
          (q) => q.reducerPath === reducerPath,
        );
        const keysToInvalidate = rule.invalidate(mutationUrl, queries);
        keysToInvalidate.forEach((key) => endpointsToInvalidate.add(key));
      }
    }

    // Auto-invalidation based on REST conventions
    if (this.enableAutoInvalidation) {
      const mutationBasePath = this.extractBasePath(mutationUrl);
      const mutationPattern = this.normalizeUrl(mutationUrl);

      for (const [, query] of this.queryRegistry) {
        if (query.reducerPath !== reducerPath) {
          continue;
        }

        const shouldInvalidate = this.shouldInvalidateQuery(
          query,
          mutationUrl,
          mutationMethod,
          mutationBasePath,
          mutationPattern,
        );

        if (shouldInvalidate) {
          endpointsToInvalidate.add(query.endpointName);
        }
      }
    }

    // Check cross-resource invalidation mappings
    for (const mapping of this.crossResourceMappings) {
      // Check if method matches (default: all mutation methods)
      const methodMatches =
        !mapping.methods ||
        mapping.methods.some(
          (m) => m.toUpperCase() === mutationMethod.toUpperCase(),
        );

      if (!methodMatches) continue;

      // Check if source pattern matches
      if (this.matchesPattern(mutationUrl, mapping.source)) {
        // Find all queries matching target patterns
        for (const [, query] of this.queryRegistry) {
          if (query.reducerPath !== reducerPath) continue;

          for (const targetPattern of mapping.invalidates) {
            if (this.matchesPattern(query.url, targetPattern)) {
              endpointsToInvalidate.add(query.endpointName);
              break;
            }
          }
        }
      }
    }

    if (this.debug && endpointsToInvalidate.size > 0) {
      console.debug(
        `[@dtsl/rtk-query] Invalidating ${endpointsToInvalidate.size} endpoints for ${mutationMethod} ${mutationUrl}:`,
        Array.from(endpointsToInvalidate),
      );
    }

    return Array.from(endpointsToInvalidate);
  }

  /**
   * Determine if a query should be invalidated by a mutation
   */
  private shouldInvalidateQuery(
    query: UrlPattern,
    mutationUrl: string,
    mutationMethod: string,
    mutationBasePath: string,
    _mutationPattern: string,
  ): boolean {
    const method = mutationMethod.toUpperCase();

    // Same base path means related resources
    const sameBasePath = query.basePath === mutationBasePath;

    // Check if mutation is on a specific item (has ID)
    const mutationHasId = this.hasResourceId(mutationUrl);
    const queryHasId = this.hasResourceId(query.url);

    switch (method) {
      case "POST":
        // POST creates new item -> invalidate list queries on same resource
        return sameBasePath && !queryHasId;

      case "PUT":
      case "PATCH":
        // PUT/PATCH updates item -> invalidate:
        // 1. List queries on same resource (item might affect list order/filtering)
        // 2. The specific item query
        if (sameBasePath) {
          if (!queryHasId) return true; // List query
          if (mutationHasId && this.isSameResource(mutationUrl, query.url))
            return true;
        }
        return false;

      case "DELETE":
        // DELETE removes item -> invalidate:
        // 1. List queries on same resource
        // 2. The specific item query being deleted
        if (sameBasePath) {
          if (!queryHasId) return true; // List query
          if (mutationHasId && this.isSameResource(mutationUrl, query.url))
            return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Normalize URL to a pattern (replace IDs with :id)
   */
  private normalizeUrl(url: string): string {
    // Remove query string
    const urlWithoutQuery = url.split("?")[0] ?? url;

    // Replace numeric IDs with :id
    // Matches: /123, /abc-123-def (UUIDs), etc.
    return urlWithoutQuery
      .replace(/\/\d+/g, "/:id")
      .replace(
        /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
        "/:id",
      )
      .replace(/\/[a-f0-9]{24}/gi, "/:id"); // MongoDB ObjectIds
  }

  /**
   * Extract base path from URL (e.g., /api/users/123 -> /api/users)
   */
  private extractBasePath(url: string): string {
    const urlWithoutQuery = url.split("?")[0] ?? url;
    const segments = urlWithoutQuery.split("/").filter(Boolean);

    // Remove last segment if it looks like an ID
    const lastSegment = segments[segments.length - 1];
    if (segments.length > 0 && lastSegment && this.looksLikeId(lastSegment)) {
      segments.pop();
    }

    return "/" + segments.join("/");
  }

  /**
   * Check if a URL segment looks like an ID
   */
  private looksLikeId(segment: string): boolean {
    // Numeric ID
    if (/^\d+$/.test(segment)) return true;
    // UUID
    if (
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        segment,
      )
    )
      return true;
    // MongoDB ObjectId
    if (/^[a-f0-9]{24}$/i.test(segment)) return true;
    return false;
  }

  /**
   * Check if URL has a resource ID
   */
  private hasResourceId(url: string): boolean {
    const urlWithoutQuery = url.split("?")[0] ?? url;
    const segments = urlWithoutQuery.split("/").filter(Boolean);
    return segments.some((s) => this.looksLikeId(s));
  }

  /**
   * Check if two URLs refer to the same resource
   */
  private isSameResource(url1: string, url2: string): boolean {
    return this.normalizeUrl(url1) === this.normalizeUrl(url2);
  }

  /**
   * Add a custom invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * Add cross-resource invalidation mapping
   *
   * @example
   * // When any user is modified, also invalidate orders
   * urlInvalidationManager.invalidateOn('/users/*', ['/orders', '/orders/*']);
   *
   * @example
   * // When user 123 is deleted, invalidate their orders
   * urlInvalidationManager.invalidateOn('/users/*', ['/orders'], ['DELETE']);
   */
  invalidateOn(
    sourcePattern: string,
    targetPatterns: string[],
    methods?: string[],
  ): void {
    this.crossResourceMappings.push({
      source: sourcePattern,
      invalidates: targetPatterns,
      methods,
    });

    if (this.debug) {
      console.debug(
        `[@dtsl/rtk-query] Added cross-resource invalidation: ${sourcePattern} -> ${targetPatterns.join(", ")}`,
      );
    }
  }

  /**
   * Match URL against a pattern with wildcards
   * Supports: * (single segment), ** (any path)
   *
   * @example
   * matchesPattern('/users/123', '/users/*') // true
   * matchesPattern('/users/123/orders', '/users/**') // true
   * matchesPattern('/orders', '/users/*') // false
   */
  private matchesPattern(url: string, pattern: string): boolean {
    // Remove query strings
    const cleanUrl = url.split("?")[0] ?? url;
    const cleanPattern = pattern.split("?")[0] ?? pattern;

    // Convert pattern to regex
    const regexPattern = cleanPattern
      // Escape special regex characters except *
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      // ** matches any path (including slashes)
      .replace(/\*\*/g, ".*")
      // * matches a single segment (no slashes)
      .replace(/\*/g, "[^/]+");

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(cleanUrl);
  }

  /**
   * Clear all registered queries
   */
  clear(): void {
    this.queryRegistry.clear();
  }

  /**
   * Get statistics about registered queries
   */
  getStats(): { totalQueries: number; byReducerPath: Record<string, number> } {
    const byReducerPath: Record<string, number> = {};

    for (const query of this.queryRegistry.values()) {
      byReducerPath[query.reducerPath] =
        (byReducerPath[query.reducerPath] || 0) + 1;
    }

    return {
      totalQueries: this.queryRegistry.size,
      byReducerPath,
    };
  }

  /**
   * Enable or disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}

// Window-level singleton so the instance is shared across MFE bundles
// (module-level singletons break when Module Federation doesn't deduplicate the package)
const MANAGER_KEY = '__DTSL_URL_INVALIDATION_MANAGER__';

function getOrCreateManager(): UrlInvalidationManager {
  const globalObj = typeof window !== 'undefined' ? window : globalThis;
  const record = globalObj as unknown as Record<string, unknown>;
  if (!record[MANAGER_KEY]) {
    record[MANAGER_KEY] = new UrlInvalidationManager();
  }
  return record[MANAGER_KEY] as UrlInvalidationManager;
}

export const urlInvalidationManager = getOrCreateManager();
