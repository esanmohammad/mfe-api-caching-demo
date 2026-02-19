/**
 * Base Query Router
 * Routes endpoint calls to the correct underlying baseQuery based on endpoint name.
 * Enables multiple MFEs with different baseUrls to share the same reducerPath.
 */

import type { BaseQueryFn } from '@reduxjs/toolkit/query';

/**
 * A baseQuery function augmented with the ability to add per-endpoint routes.
 */
export interface BaseQueryRouter {
  /** The baseQuery function — pass this to rtkCreateApi. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseQuery: BaseQueryFn<any, any, any, any, any>;
  /** Route a set of endpoint names to a specific baseQuery. */
  addRoutes(endpointNames: string[], baseQuery: BaseQueryFn): void;
  /** Number of explicitly routed endpoints (excludes default). */
  getRouteCount(): number;
}

/**
 * Create a base query router that dispatches to different baseQuery
 * implementations based on the endpoint name.
 *
 * The `defaultBaseQuery` handles any endpoint without an explicit route.
 */
export function createBaseQueryRouter(defaultBaseQuery: BaseQueryFn): BaseQueryRouter {
  const endpointMap = new Map<string, BaseQueryFn>();

  // The actual baseQuery function that RTK Query will call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routerFn: BaseQueryFn<any, any, any, any, any> = async (args, api, extraOptions) => {
    const bq = endpointMap.get(api.endpoint) ?? defaultBaseQuery;
    return bq(args, api, extraOptions);
  };

  return {
    baseQuery: routerFn,
    addRoutes(endpointNames: string[], baseQuery: BaseQueryFn) {
      for (const name of endpointNames) {
        endpointMap.set(name, baseQuery);
      }
    },
    getRouteCount() {
      return endpointMap.size;
    },
  };
}
