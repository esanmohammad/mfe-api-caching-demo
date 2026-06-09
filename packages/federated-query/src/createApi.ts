/**
 * Enhanced createApi
 * Wraps RTK Query's createApi with MFE support while maintaining 100% API compatibility
 */

import {
  createApi as rtkCreateApi,
  type BaseQueryFn,
  type EndpointDefinitions,
} from "@reduxjs/toolkit/query/react";
import {
  registerApi,
  getRegisteredApi,
  getRegisteredConfig,
  getRegisteredRouter,
  updateConfigSnapshot,
  isApiRegistered,
  subscribe,
} from "./core/globalRegistry";
import type { ApiConfigSnapshot } from "./core/globalRegistry";
import { createBaseQueryRouter } from "./core/baseQueryRouter";
import { detectMfeName } from "./core/mfeContext";
import {
  enhanceBaseQuery,
  type EnhancedBaseQueryOptions,
} from "./enhancers/baseQueryEnhancer";
import { createEnhancedSerializer } from "./enhancers/serializerEnhancer";
import { createCacheLifecycleMiddleware } from "./middleware/cacheLifecycleMiddleware";
import { createUrlInvalidationMiddleware } from "./middleware/urlInvalidationMiddleware";
import { configureStore, type EnhancedStore } from "@reduxjs/toolkit";

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
 * Warn when keepUnusedDataFor diverges between MFEs sharing the same reducerPath.
 * This is the only config that is still first-registerer-wins (set once on the
 * RTK Query instance). tagTypes are merged, baseQuery is routed per-endpoint,
 * and mfeOptions are per-MFE via the router.
 */
function warnOnKeepUnusedDataDivergence(
  reducerPath: string,
  mfeName: string,
  existing: ApiConfigSnapshot | undefined,
  incomingKeepUnusedDataFor: number | undefined,
): void {
  if (!existing) return;

  if (
    incomingKeepUnusedDataFor !== undefined &&
    existing.keepUnusedDataFor !== undefined &&
    incomingKeepUnusedDataFor !== existing.keepUnusedDataFor
  ) {
    console.warn(
      `[federated-query] Config divergence on "${reducerPath}" (from ${mfeName}): keepUnusedDataFor differs (existing: ${existing.keepUnusedDataFor}, incoming: ${incomingKeepUnusedDataFor}). Using existing value.`,
    );
  }
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
 * import { createApi, fetchBaseQuery } from 'federated-query';
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
  ReducerPath extends string = "api",
  TagTypes extends string = never,
>(
  options: Parameters<
    typeof rtkCreateApi<BaseQuery, Definitions, ReducerPath, TagTypes>
  >[0] &
    MfeCreateApiOptions,
): ReturnType<
  typeof rtkCreateApi<BaseQuery, Definitions, ReducerPath, TagTypes>
> {
  const {
    reducerPath = "api" as ReducerPath,
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
      const mfeName = detectMfeName();
      const existingConfig = getRegisteredConfig(reducerPath);

      console.debug(
        `[federated-query] Found existing API instance: ${reducerPath}, injecting endpoints (from ${mfeName})`,
      );

      // 1. Merge tagTypes via enhanceEndpoints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const incomingTagTypes: string[] = (rest as any).tagTypes ?? [];
      const existingTagTypes: readonly string[] = existingConfig?.tagTypes ?? [];
      const newTags = incomingTagTypes.filter(
        (t) => !existingTagTypes.includes(t),
      );
      if (newTags.length > 0) {
        existingApi.enhanceEndpoints({ addTagTypes: newTags });
        const mergedTagTypes = [...existingTagTypes, ...newTags];
        updateConfigSnapshot(reducerPath, { tagTypes: mergedTagTypes });
        console.debug(
          `[federated-query] Merged ${newTags.length} new tagType(s) into "${reducerPath}": [${newTags.join(", ")}]`,
        );
      }

      // 2. Warn if keepUnusedDataFor diverges (only remaining first-registerer-wins config)
      warnOnKeepUnusedDataDivergence(reducerPath, mfeName, existingConfig, keepUnusedDataFor);

      // 3. Snapshot existing endpoint names before injection
      const existingEndpointNames = new Set(
        Object.keys(existingApi.endpoints),
      );

      // 4. Inject endpoints (existing behavior)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enhancedApi = existingApi.injectEndpoints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        endpoints: endpoints as any,
        overrideExisting: false, // Don't override existing endpoints
      });

      // 5. Route new endpoints to this MFE's baseQuery
      const router = getRegisteredRouter(reducerPath);
      if (router) {
        const newEndpointNames = Object.keys(enhancedApi.endpoints).filter(
          (name) => !existingEndpointNames.has(name),
        );
        if (newEndpointNames.length > 0) {
          // Enhance this MFE's baseQuery with the same MFE features
          const enhancedIncomingBaseQuery = enhanceBaseQuery(baseQuery, {
            enableCoalescing: mfeOptions?.enableCoalescing ?? true,
            enableTracking: mfeOptions?.enableTracking ?? true,
            addMfeHeader: mfeOptions?.addMfeHeader ?? true,
            mfeHeaderName: mfeOptions?.mfeHeaderName ?? "X-MFE-Source",
            enableUrlInvalidation: mfeOptions?.enableUrlInvalidation ?? true,
            reducerPath,
          });
          router.addRoutes(newEndpointNames, enhancedIncomingBaseQuery);
          console.debug(
            `[federated-query] Routed ${newEndpointNames.length} endpoint(s) from ${mfeName} to its own baseQuery: [${newEndpointNames.join(", ")}]`,
          );
        }
      }

      // 6. Subscribe this MFE
      subscribe(reducerPath, mfeName);

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
        mfeHeaderName: mfeOptions?.mfeHeaderName ?? "X-MFE-Source",
        enableUrlInvalidation: mfeOptions?.enableUrlInvalidation ?? true,
        reducerPath,
      });

  // Wrap in a router so future MFEs can add their own baseQuery routes
  const router = standalone
    ? null
    : createBaseQueryRouter(enhancedBaseQuery);

  // Create enhanced serializer
  const enhancedSerializer = createEnhancedSerializer({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalSerializer: serializeQueryArgs as any,
  });

  // Create the API with enhanced options
  // When not standalone, use the router so future MFEs' endpoints are routed correctly
  const api = rtkCreateApi({
    ...rest,
    reducerPath,
    baseQuery: (router ? router.baseQuery : enhancedBaseQuery) as BaseQuery,
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
    const cacheLifecycleMiddleware =
      createCacheLifecycleMiddleware(reducerPath);
    const urlInvalidationMiddleware =
      createUrlInvalidationMiddleware(reducerPath);

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

    // Build config snapshot for future divergence detection and tagTypes merging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomingTagTypes: string[] = (rest as any).tagTypes ?? [];
    const configSnapshot: ApiConfigSnapshot = {
      keepUnusedDataFor: keepUnusedDataFor ?? 300,
      tagTypes: incomingTagTypes,
    };

    registerApi(reducerPath, apiAny, minimalStore as EnhancedStore, mfeName, configSnapshot, router ?? undefined);
  }

  return api;
}

// Re-export the original createApi for edge cases
export { createApi as originalCreateApi } from "@reduxjs/toolkit/query/react";
