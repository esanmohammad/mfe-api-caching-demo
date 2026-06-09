/**
 * federated-query
 *
 * RTK Query wrapper with transparent MFE (micro-frontend) support.
 *
 * This package is a drop-in replacement for @reduxjs/toolkit/query.
 * It adds request coalescing, shared caching, and unified invalidation
 * across micro-frontends without any API changes.
 *
 * @example
 * ```typescript
 * // Before (standard RTK Query)
 * import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
 *
 * // After (federated-query - same API!)
 * import { createApi, fetchBaseQuery } from 'federated-query';
 *
 * export const api = createApi({
 *   reducerPath: 'api',
 *   baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
 *   endpoints: (builder) => ({
 *     getUser: builder.query({
 *       query: (id) => `/users/${id}`,
 *     }),
 *   }),
 * });
 * ```
 *
 * @packageDocumentation
 */

// Main API exports (drop-in replacements)
export { createApi, originalCreateApi } from './createApi';
export { fetchBaseQuery, originalFetchBaseQuery } from './fetchBaseQuery';

// Re-export core RTK Query exports
export {
  // Query lifecycle
  QueryStatus,
  skipToken,

  // Utilities
  retry,
} from '@reduxjs/toolkit/query';

// Core utilities for advanced usage
export {
  getGlobalRegistry,
  getRegistryStats,
  resetRegistry,
  getRegisteredApi,
  getRegisteredStore,
  getRegisteredConfig,
  getRegisteredRouter,
  updateConfigSnapshot,
  isApiRegistered,
  subscribe,
  unsubscribe,
} from './core/globalRegistry';

export { createBaseQueryRouter } from './core/baseQueryRouter';

export {
  getMfeContext,
  setMfeContext,
  clearMfeContext,
  detectMfeName,
  isInMfeEnvironment,
  generateRequestId,
} from './core/mfeContext';

export {
  refCountManager,
  RefCountManager,
} from './core/refCountManager';

export {
  requestTracker,
  RequestTracker,
} from './core/requestTracker';

// Enhancers for custom base queries
export { enhanceBaseQuery } from './enhancers/baseQueryEnhancer';
export {
  createEnhancedSerializer,
  generateCacheKey,
  parseCacheKey,
} from './enhancers/serializerEnhancer';

// Middleware
export { createCacheLifecycleMiddleware } from './middleware/cacheLifecycleMiddleware';
export { createUrlInvalidationMiddleware } from './middleware/urlInvalidationMiddleware';

// Invalidation
export {
  urlInvalidationManager,
  UrlInvalidationManager,
} from './invalidation/urlInvalidationManager';

// Type exports
export type { MfeCreateApiOptions } from './createApi';
export type { MfeFetchBaseQueryArgs } from './fetchBaseQuery';
export type { RefCountState, RefCountStats } from './core/refCountManager';
export type { TrackedRequest, RequestTrackerStats } from './core/requestTracker';
export type { ApiRegistryEntry, ApiConfigSnapshot, GlobalRegistry } from './core/globalRegistry';
export type { BaseQueryRouter } from './core/baseQueryRouter';
export type { EnhancedBaseQueryOptions } from './enhancers/baseQueryEnhancer';
export type { SerializerOptions } from './enhancers/serializerEnhancer';
export type {
  UrlPattern,
  InvalidationRule,
  UrlInvalidationOptions,
  CrossResourceInvalidation,
} from './invalidation/urlInvalidationManager';
