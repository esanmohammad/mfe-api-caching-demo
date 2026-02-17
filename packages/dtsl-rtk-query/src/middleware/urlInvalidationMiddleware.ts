/**
 * URL-Based Invalidation Middleware
 *
 * Automatically invalidates queries when mutations complete,
 * based on URL pattern matching rather than manual tags.
 */

import type { Middleware, UnknownAction, Dispatch } from '@reduxjs/toolkit';
import { urlInvalidationManager } from '../invalidation/urlInvalidationManager';

interface MutationAction extends UnknownAction {
  payload?: unknown;
  meta?: {
    arg?: {
      type?: string;
      endpointName?: string;
      originalArgs?: unknown;
    };
    requestId?: string;
    requestStatus?: 'pending' | 'fulfilled' | 'rejected';
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
 * Extract URL from mutation args
 */
function extractUrl(args: unknown): string | null {
  if (typeof args === 'string') {
    return args;
  }
  if (typeof args === 'object' && args !== null) {
    const obj = args as Record<string, unknown>;
    if (typeof obj.url === 'string') {
      return obj.url;
    }
  }
  return null;
}

/**
 * Extract HTTP method from mutation args
 */
function extractMethod(args: unknown): string {
  if (typeof args === 'object' && args !== null) {
    const obj = args as Record<string, unknown>;
    if (typeof obj.method === 'string') {
      return obj.method.toUpperCase();
    }
  }
  // Default to POST for mutations without explicit method
  return 'POST';
}

/**
 * Creates middleware that automatically invalidates queries based on mutation URLs
 */
export function createUrlInvalidationMiddleware(reducerPath: string): Middleware {
  return (store) => (next) => (action: unknown) => {
    const result = next(action as UnknownAction);
    const mutationAction = action as MutationAction;

    // Only process fulfilled mutations
    if (typeof mutationAction.type !== 'string') {
      return result;
    }

    // Check if this is a fulfilled mutation for our API
    const isFulfilledMutation =
      mutationAction.type.startsWith(`${reducerPath}/`) &&
      mutationAction.type.includes('/executeMutation/fulfilled');

    if (!isFulfilledMutation) {
      return result;
    }

    // Extract mutation details
    const meta = mutationAction.meta;
    if (!meta?.arg?.originalArgs) {
      return result;
    }

    const url = extractUrl(meta.arg.originalArgs);
    const method = extractMethod(meta.arg.originalArgs);

    if (!url) {
      return result;
    }

    // Find queries to invalidate
    const cacheKeysToInvalidate = urlInvalidationManager.findQueriesToInvalidate(
      url,
      method,
      reducerPath
    );

    if (cacheKeysToInvalidate.length === 0) {
      return result;
    }

    // Get the API state to find endpoint information
    const state = store.getState() as Record<string, ApiState>;
    const apiState = state[reducerPath];

    if (!apiState?.queries) {
      return result;
    }

    // Build set of endpoints to refetch
    const endpointsToRefetch = new Set<string>();

    for (const cacheKey of cacheKeysToInvalidate) {
      const queryEntry = apiState.queries[cacheKey];
      if (queryEntry?.endpointName) {
        endpointsToRefetch.add(queryEntry.endpointName);
      }
    }

    // Dispatch invalidation action for each endpoint
    // RTK Query will handle the actual refetch
    if (endpointsToRefetch.size > 0) {
      console.debug(
        `[@dtsl/rtk-query] Auto-invalidating ${endpointsToRefetch.size} endpoints after ${method} ${url}`
      );

      // Dispatch a custom action that the API can listen for
      store.dispatch({
        type: `${reducerPath}/urlInvalidation`,
        payload: {
          mutationUrl: url,
          mutationMethod: method,
          invalidatedCacheKeys: cacheKeysToInvalidate,
          invalidatedEndpoints: Array.from(endpointsToRefetch),
        },
      });
    }

    return result;
  };
}

/**
 * Creates a listener that triggers refetches for URL-invalidated queries
 * This should be used with RTK Query's invalidation API
 */
export function createUrlInvalidationHandler(
  api: {
    util: {
      invalidateTags: (tags: Array<{ type: string; id?: string | number }>) => unknown;
      resetApiState: () => unknown;
    };
    endpoints: Record<string, { initiate: (arg: unknown) => unknown }>;
  },
  dispatch: Dispatch
) {
  return (action: unknown) => {
    const invalidationAction = action as {
      type: string;
      payload?: {
        invalidatedCacheKeys: string[];
        invalidatedEndpoints: string[];
      };
    };

    if (!invalidationAction.type?.endsWith('/urlInvalidation')) {
      return;
    }

    const { invalidatedEndpoints } = invalidationAction.payload || {};
    if (!invalidatedEndpoints?.length) {
      return;
    }

    // For each invalidated endpoint, we can trigger a refetch
    // The actual implementation depends on how the consumer wants to handle it
    // Option 1: Use tag invalidation (if they've set up tags)
    // Option 2: Manually refetch specific queries

    console.debug(
      `[@dtsl/rtk-query] URL invalidation triggered for endpoints:`,
      invalidatedEndpoints
    );
  };
}
