/**
 * Enhanced createApi
 * Wraps RTK Query's createApi with MFE support while maintaining 100% API compatibility
 */

import {
  createApi as rtkCreateApi,
  type BaseQueryFn,
  type EndpointDefinitions,
} from '@reduxjs/toolkit/query/react';
import {
  registerApi,
  getRegisteredApi,
  isApiRegistered,
} from './core/globalRegistry';
import { detectMfeName } from './core/mfeContext';
import { enhanceBaseQuery, type EnhancedBaseQueryOptions } from './enhancers/baseQueryEnhancer';
import { createEnhancedSerializer } from './enhancers/serializerEnhancer';
import { createCacheLifecycleMiddleware } from './middleware/cacheLifecycleMiddleware';
import { createUrlInvalidationMiddleware } from './middleware/urlInvalidationMiddleware';
import { configureStore, type EnhancedStore } from '@reduxjs/toolkit';

/**
 * Extended options for MFE-aware createApi
 */
export interface MfeCreateApiOptions {
  /**
   * MFE-specific configuration
   */
  mfeOptions?: EnhancedBaseQueryOptions & {
    /**
     * Disable MFE features entirely (run as standalone)
     */
    standalone?: boolean;
  };
}

/**
 * Create an API with MFE support
 *
 * This is a drop-in replacement for RTK Query's createApi.
 * It adds transparent request coalescing, tracking, and shared caching
 * across micro-frontends.
 *
 * Key feature: When multiple MFEs call createApi with the same reducerPath,
 * endpoints are INJECTED into the existing API instance, allowing each MFE
 * to define its own endpoints while sharing cache.
 *
 * @example
 * ```typescript
 * import { createApi, fetchBaseQuery } from '@dtsl/rtk-query';
 *
 * export const api = createApi({
 *   reducerPath: 'api',
 *   baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
 *   tagTypes: ['User', 'Order'],
 *   endpoints: (builder) => ({
 *     getUser: builder.query({
 *       query: (id) => `/users/${id}`,
 *       providesTags: (result, error, id) => [{ type: 'User', id }],
 *     }),
 *   }),
 * });
 *
 * export const { useGetUserQuery } = api;
 * ```
 */
export function createApi<
  BaseQuery extends BaseQueryFn,
  Definitions extends EndpointDefinitions,
  ReducerPath extends string = 'api',
  TagTypes extends string = never
>(
  options: Parameters<typeof rtkCreateApi<BaseQuery, Definitions, ReducerPath, TagTypes>>[0] &
    MfeCreateApiOptions
): ReturnType<typeof rtkCreateApi<BaseQuery, Definitions, ReducerPath, TagTypes>> {
  const {
    reducerPath = 'api' as ReducerPath,
    baseQuery,
    mfeOptions,
    serializeQueryArgs,
    keepUnusedDataFor,
    endpoints,
    ...rest
  } = options;

  const standalone = mfeOptions?.standalone ?? false;

  // Check if this API already exists (singleton pattern)
  if (!standalone && isApiRegistered(reducerPath)) {
    const existingApi = getRegisteredApi(reducerPath);
    if (existingApi) {
      console.debug(
        `[@dtsl/rtk-query] Found existing API instance: ${reducerPath}, injecting endpoints`
      );

      // Inject endpoints from this MFE into the existing API
      // This allows each MFE to define its own endpoints while sharing cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enhancedApi = existingApi.injectEndpoints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        endpoints: endpoints as any,
        overrideExisting: false, // Don't override existing endpoints
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return enhancedApi as any;
    }
  }

  // Enhance the base query with MFE features
  const enhancedBaseQuery = standalone
    ? baseQuery
    : enhanceBaseQuery(baseQuery, {
        enableCoalescing: mfeOptions?.enableCoalescing ?? true,
        enableTracking: mfeOptions?.enableTracking ?? true,
        addMfeHeader: mfeOptions?.addMfeHeader ?? true,
        mfeHeaderName: mfeOptions?.mfeHeaderName ?? 'X-MFE-Source',
        enableUrlInvalidation: mfeOptions?.enableUrlInvalidation ?? true,
        reducerPath,
      });

  // Create enhanced serializer
  const enhancedSerializer = createEnhancedSerializer({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalSerializer: serializeQueryArgs as any,
  });

  // Create the API with enhanced options
  const api = rtkCreateApi({
    ...rest,
    reducerPath,
    baseQuery: enhancedBaseQuery as BaseQuery,
    serializeQueryArgs: enhancedSerializer,
    endpoints,
    // Extend cache lifetime for MFE switching (5 minutes default)
    keepUnusedDataFor: keepUnusedDataFor ?? 300,
  });

  // Register in global registry (if not standalone)
  if (!standalone) {
    const mfeName = detectMfeName();

    // Create a minimal store for registration
    // The actual store will be replaced when Provider mounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiAny = api as any;
    const cacheLifecycleMiddleware = createCacheLifecycleMiddleware(reducerPath);
    const urlInvalidationMiddleware = createUrlInvalidationMiddleware(reducerPath);
    const minimalStore = configureStore({
      reducer: {
        [reducerPath]: apiAny.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware()
          .concat(apiAny.middleware)
          .concat(cacheLifecycleMiddleware)
          .concat(urlInvalidationMiddleware),
    });

    registerApi(
      reducerPath,
      apiAny,
      minimalStore as EnhancedStore,
      mfeName
    );
  }

  return api;
}

// Re-export the original createApi for edge cases
export { createApi as originalCreateApi } from '@reduxjs/toolkit/query/react';
