/**
 * URL-Based Invalidation Middleware
 *
 * Automatically invalidates queries when mutations complete,
 * based on URL pattern matching rather than manual tags.
 */

import type { Middleware, UnknownAction } from "@reduxjs/toolkit";
import { urlInvalidationManager } from "../invalidation/urlInvalidationManager";
import { getRegisteredApi } from "../core/globalRegistry";

interface MutationAction extends UnknownAction {
  payload?: unknown;
  meta?: {
    arg?: {
      type?: string;
      endpointName?: string;
      originalArgs?: unknown;
    };
    requestId?: string;
    requestStatus?: "pending" | "fulfilled" | "rejected";
    baseQueryMeta?: {
      request?: Request;
      response?: Response;
    };
  };
}

interface ApiState {
  queries?: Record<string, { endpointName?: string; originalArgs?: unknown }>;
  mutations?: Record<string, { endpointName?: string; originalArgs?: unknown }>;
}

/**
 * Extract URL from mutation action
 * Priority: 1) baseQueryMeta.request.url, 2) originalArgs.url, 3) originalArgs as string
 */
function extractUrlFromAction(action: MutationAction): string | null {
  const meta = action.meta;

  // First, try to get from the actual request (most reliable)
  const requestUrl = meta?.baseQueryMeta?.request?.url;
  if (requestUrl) {
    try {
      // Parse URL to get just the pathname
      const url = new URL(requestUrl);
      return url.pathname;
    } catch {
      // If it's not a full URL, use as-is
      return requestUrl;
    }
  }

  // Fallback: check originalArgs
  const args = meta?.arg?.originalArgs;
  if (typeof args === "string") {
    return args;
  }
  if (typeof args === "object" && args !== null) {
    const obj = args as Record<string, unknown>;
    if (typeof obj.url === "string") {
      return obj.url;
    }
  }
  return null;
}

/**
 * Extract HTTP method from mutation action
 * Priority: 1) baseQueryMeta.request.method, 2) originalArgs.method, 3) default POST
 */
function extractMethodFromAction(action: MutationAction): string {
  const meta = action.meta;

  // First, try to get from the actual request (most reliable)
  const requestMethod = meta?.baseQueryMeta?.request?.method;
  if (requestMethod) {
    return requestMethod.toUpperCase();
  }

  // Fallback: check originalArgs
  const args = meta?.arg?.originalArgs;
  if (typeof args === "object" && args !== null) {
    const obj = args as Record<string, unknown>;
    if (typeof obj.method === "string") {
      return obj.method.toUpperCase();
    }
  }
  // Default to POST for mutations without explicit method
  return "POST";
}

/**
 * Creates middleware that automatically invalidates queries based on mutation URLs
 */
export function createUrlInvalidationMiddleware(
  reducerPath: string,
): Middleware {
  return (store) => (next) => (action: unknown) => {
    const result = next(action as UnknownAction);
    const mutationAction = action as MutationAction;

    // Only process fulfilled mutations
    if (typeof mutationAction.type !== "string") {
      return result;
    }

    // Check if this is a fulfilled mutation for our API
    // RTK Query uses either "executeMutation/fulfilled" or just "fulfilled" depending on version
    const isFulfilledMutation =
      mutationAction.type.startsWith(`${reducerPath}/`) &&
      (mutationAction.type.includes("/executeMutation/fulfilled") ||
       (mutationAction.type.endsWith("/fulfilled") && mutationAction.meta?.arg?.type === "mutation"));

    if (!isFulfilledMutation) {
      return result;
    }

    // Extract mutation details from the action
    const url = extractUrlFromAction(mutationAction);
    const method = extractMethodFromAction(mutationAction);

    if (!url) {
      return result;
    }

    // Find endpoint names to invalidate based on URL patterns
    const endpointsToInvalidate =
      urlInvalidationManager.findQueriesToInvalidate(url, method, reducerPath);

    if (endpointsToInvalidate.length === 0) {
      return result;
    }

    // Get the API state to find all queries for these endpoints
    const state = store.getState() as Record<string, ApiState>;
    const apiState = state[reducerPath];

    if (!apiState?.queries) {
      return result;
    }

    // Get the registered API to trigger refetches
    const api = getRegisteredApi(reducerPath);
    if (!api) {
      console.warn(
        `[@dtsl/rtk-query] Cannot find registered API for ${reducerPath}, skipping URL invalidation`,
      );
      return result;
    }

    // Find all queries in RTK Query state that match the endpoints to invalidate
    const endpointSet = new Set(endpointsToInvalidate);
    const queriesToRefetch: Array<{
      endpointName: string;
      originalArgs: unknown;
      cacheKey: string;
    }> = [];

    for (const [cacheKey, queryEntry] of Object.entries(apiState.queries)) {
      if (queryEntry?.endpointName && endpointSet.has(queryEntry.endpointName)) {
        queriesToRefetch.push({
          endpointName: queryEntry.endpointName,
          originalArgs: queryEntry.originalArgs,
          cacheKey,
        });
      }
    }

    if (queriesToRefetch.length === 0) {
      return result;
    }

    console.debug(
      `[@dtsl/rtk-query] Auto-invalidating ${queriesToRefetch.length} queries after ${method} ${url}`,
    );

    // Trigger refetch for each invalidated query using RTK Query's initiate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const endpoints = api.endpoints as Record<string, any>;

    for (const query of queriesToRefetch) {
      const endpoint = endpoints[query.endpointName];
      if (endpoint?.initiate) {
        // Dispatch with forceRefetch to bypass cache
        store.dispatch(
          endpoint.initiate(query.originalArgs, {
            forceRefetch: true,
            subscribe: false, // Don't create new subscription
          }),
        );
        console.debug(
          `[@dtsl/rtk-query] Refetching ${query.endpointName} (${query.cacheKey})`,
        );
      }
    }

    return result;
  };
}
