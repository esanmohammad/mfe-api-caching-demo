/**
 * Enhanced createApi
 * Wraps RTK Query's createApi with MFE support while maintaining 100% API compatibility.
 *
 * Store ownership model
 * ---------------------
 * Non-standalone APIs do NOT live in the consumer's store. Their reducer and
 * middleware are injected into a single shared store (see core/sharedStore.ts),
 * and the generated React hooks are bound to that store via a dedicated context
 * (see core/federatedContext.ts). This is what makes the cache shared across
 * MFEs — and it means each MFE keeps its OWN store, untouched, for its own local
 * state. Standalone APIs fall back to vanilla RTK Query on the default context.
 */

import {
  buildCreateApi,
  coreModule,
  reactHooksModule,
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
import { getSharedStore, injectApiIntoSharedStore } from "./core/sharedStore";
import { getFederatedHooks } from "./core/federatedContext";
import { logger } from "./core/logger";

/**
 * createApi bound to the federated context. Generated hooks read/dispatch the
 * shared store, regardless of which MFE's components call them.
 */
const federatedCreateApi = buildCreateApi(
  coreModule(),
  reactHooksModule({ hooks: getFederatedHooks() }),
);

/**
 * Extended options for MFE-aware createApi
 */
export interface MfeCreateApiOptions {
  /**
   * MFE-specific configuration
   */
  mfeOptions?: EnhancedBaseQueryOptions & {
    /**
     * Disable MFE features entirely (run as standalone, vanilla RTK Query).
     */
    standalone?: boolean;
    /**
     * Explicit name of the MFE that owns these endpoints. Used for deterministic
     * request attribution (headers, stats). Falls back to auto-detection.
     */
    mfeName?: string;
  };
}

/**
 * Resolve the MFE name once, at registration/injection time, so it can be baked
 * into the base query closure (deterministic, race-free attribution).
 */
function resolveMfeName(options: MfeCreateApiOptions): string {
  return options.mfeOptions?.mfeName ?? detectMfeName();
}

/**
 * Build the per-MFE enhanced base query options from mfeOptions.
 */
function enhanceOptionsFor(
  reducerPath: string,
  mfeName: string,
  mfeOptions: MfeCreateApiOptions["mfeOptions"],
): EnhancedBaseQueryOptions {
  return {
    enableCoalescing: mfeOptions?.enableCoalescing ?? true,
    enableTracking: mfeOptions?.enableTracking ?? true,
    addMfeHeader: mfeOptions?.addMfeHeader ?? true,
    mfeHeaderName: mfeOptions?.mfeHeaderName ?? "X-MFE-Source",
    enableUrlInvalidation: mfeOptions?.enableUrlInvalidation ?? true,
    reducerPath,
    mfeName,
  };
}

/**
 * Discover the endpoint names a builder function will produce, without needing a
 * real RTK builder. Used to detect (and warn about) name collisions before the
 * silent `overrideExisting: false` injection drops them.
 */
function getIncomingEndpointNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  endpoints: ((builder: any) => Record<string, unknown>) | undefined,
): string[] {
  if (typeof endpoints !== "function") return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recordingBuilder: any = {
      query: (def: unknown) => def,
      mutation: (def: unknown) => def,
      infiniteQuery: (def: unknown) => def,
    };
    const defs = endpoints(recordingBuilder);
    return defs && typeof defs === "object" ? Object.keys(defs) : [];
  } catch {
    return [];
  }
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
    logger.warn(
      `Config divergence on "${reducerPath}" (from ${mfeName}): keepUnusedDataFor differs (existing: ${existing.keepUnusedDataFor}, incoming: ${incomingKeepUnusedDataFor}). Using existing value.`,
    );
  }
}

/**
 * Create an API with MFE support.
 *
 * Drop-in replacement for RTK Query's createApi. When multiple MFEs call this
 * with the same reducerPath, endpoints are injected into the single shared API
 * instance so every MFE shares one cache.
 *
 * @example
 * ```typescript
 * import { createApi, fetchBaseQuery } from 'federated-query/react';
 *
 * export const api = createApi({
 *   reducerPath: 'api',
 *   baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
 *   tagTypes: ['User'],
 *   endpoints: (builder) => ({
 *     getUser: builder.query({ query: (id) => `/users/${id}` }),
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

  // ── Standalone: plain RTK Query on the default context. No sharing. ──────────
  if (standalone) {
    return rtkCreateApi({
      ...rest,
      reducerPath,
      baseQuery,
      serializeQueryArgs,
      endpoints,
      keepUnusedDataFor,
    });
  }

  const mfeName = resolveMfeName(options);

  // ── Subsequent registration: inject into the existing shared API. ───────────
  if (isApiRegistered(reducerPath)) {
    const existingApi = getRegisteredApi(reducerPath);
    if (existingApi) {
      const existingConfig = getRegisteredConfig(reducerPath);
      logger.debug(
        `Found existing API "${reducerPath}", injecting endpoints (from ${mfeName})`,
      );

      // 1. Warn on endpoint-name collisions (overrideExisting: false drops them).
      const existingEndpointNames = new Set(Object.keys(existingApi.endpoints));
      const incomingNames = getIncomingEndpointNames(
        endpoints as ((builder: unknown) => Record<string, unknown>) | undefined,
      );
      for (const name of incomingNames) {
        if (existingEndpointNames.has(name)) {
          logger.warn(
            `Endpoint "${name}" on "${reducerPath}" is already defined (from ${mfeName}). The existing definition is kept; this one is ignored. Rename it or align the definitions across MFEs.`,
          );
        }
      }

      // 2. Merge tagTypes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const incomingTagTypes: string[] = (rest as any).tagTypes ?? [];
      const existingTagTypes: readonly string[] = existingConfig?.tagTypes ?? [];
      const newTags = incomingTagTypes.filter((t) => !existingTagTypes.includes(t));
      if (newTags.length > 0) {
        existingApi.enhanceEndpoints({ addTagTypes: newTags });
        updateConfigSnapshot(reducerPath, {
          tagTypes: [...existingTagTypes, ...newTags],
        });
        logger.debug(
          `Merged ${newTags.length} new tagType(s) into "${reducerPath}": [${newTags.join(", ")}]`,
        );
      }

      // 3. Warn if keepUnusedDataFor diverges.
      warnOnKeepUnusedDataDivergence(reducerPath, mfeName, existingConfig, keepUnusedDataFor);

      // 4. Inject endpoints.
      const enhancedApi = existingApi.injectEndpoints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        endpoints: endpoints as any,
        overrideExisting: false,
      });

      // 5. Route the newly added endpoints to THIS MFE's own base query.
      const router = getRegisteredRouter(reducerPath);
      if (router) {
        const newEndpointNames = Object.keys(enhancedApi.endpoints).filter(
          (name) => !existingEndpointNames.has(name),
        );
        if (newEndpointNames.length > 0) {
          const enhancedIncomingBaseQuery = enhanceBaseQuery(
            baseQuery,
            enhanceOptionsFor(reducerPath, mfeName, mfeOptions),
          );
          router.addRoutes(newEndpointNames, enhancedIncomingBaseQuery);
          logger.debug(
            `Routed ${newEndpointNames.length} endpoint(s) from ${mfeName} to its own baseQuery: [${newEndpointNames.join(", ")}]`,
          );
        }
      }

      // 6. Subscribe this MFE.
      subscribe(reducerPath, mfeName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return enhancedApi as any;
    }
  }

  // ── First registration: create the shared API instance. ─────────────────────
  const enhancedBaseQuery = enhanceBaseQuery(
    baseQuery,
    enhanceOptionsFor(reducerPath, mfeName, mfeOptions),
  );

  // Wrap in a router so future MFEs can add their own per-endpoint base queries.
  const router = createBaseQueryRouter(enhancedBaseQuery);

  const enhancedSerializer = createEnhancedSerializer({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalSerializer: serializeQueryArgs as any,
  });

  const api = federatedCreateApi({
    ...rest,
    reducerPath,
    baseQuery: router.baseQuery as BaseQuery,
    serializeQueryArgs: enhancedSerializer,
    endpoints,
    // Extend cache lifetime for MFE switching. NOTE: this overrides RTK Query's
    // default of 60s. Pass your own keepUnusedDataFor to opt out.
    keepUnusedDataFor: keepUnusedDataFor ?? 300,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any;

  // Inject reducer + middleware into the single shared store.
  injectApiIntoSharedStore(
    reducerPath,
    apiAny.reducer,
    apiAny.middleware,
    createCacheLifecycleMiddleware(reducerPath),
    createUrlInvalidationMiddleware(reducerPath),
  );

  const configSnapshot: ApiConfigSnapshot = {
    keepUnusedDataFor: keepUnusedDataFor ?? 300,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tagTypes: (rest as any).tagTypes ?? [],
  };

  registerApi(reducerPath, apiAny, getSharedStore(), mfeName, configSnapshot, router);

  return api;
}

// Re-export the original createApi for edge cases
export { createApi as originalCreateApi } from "@reduxjs/toolkit/query/react";
