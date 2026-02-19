/**
 * @dtsl/rtk-query/react
 *
 * React-specific exports for @dtsl/rtk-query.
 *
 * This module provides the Provider component and re-exports
 * all React hooks from RTK Query.
 *
 * @example
 * ```typescript
 * import { Provider } from '@dtsl/rtk-query/react';
 * import { store } from './store';
 *
 * function App() {
 *   return (
 *     <Provider store={store}>
 *       <MyComponent />
 *     </Provider>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// MFE-aware Provider
export { Provider, BaseProvider } from './Provider';

// Re-export createApi with react hooks
export { createApi, originalCreateApi } from './createApi';
export { fetchBaseQuery, originalFetchBaseQuery } from './fetchBaseQuery';

// Re-export core RTK Query React exports
export {
  // Core
  QueryStatus,
  skipToken,

  // Utilities
  retry,

  // API utilities
  setupListeners,
} from '@reduxjs/toolkit/query/react';

// Re-export core utilities
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

// Enhancers
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

// Types
export type { MfeProviderProps } from './Provider';
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
