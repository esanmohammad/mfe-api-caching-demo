/**
 * Cache Lifecycle Middleware
 * Tracks RTK Query cache additions/removals to properly manage ref counts
 */

import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import { refCountManager } from '../core/refCountManager';
import { getMfeContext } from '../core/mfeContext';
import { logger } from '../core/logger';

interface CacheAction extends UnknownAction {
  payload?: {
    queryCacheKey?: string;
    requestId?: string;
  };
}

/**
 * Middleware that tracks RTK Query cache lifecycle events
 * and decrements ref counts when cache entries are removed
 */
export function createCacheLifecycleMiddleware(reducerPath: string): Middleware {
  return (_store) => (next) => (action: unknown) => {
    const cacheAction = action as CacheAction;
    const result = next(action);

    // Check if this is a cache removal action for our API
    if (typeof cacheAction.type === 'string') {
      // Handle removeQueryResult action
      if (cacheAction.type === `${reducerPath}/removeQueryResult`) {
        const queryCacheKey = cacheAction.payload?.queryCacheKey;
        if (queryCacheKey) {
          handleCacheRemoval(queryCacheKey);
        }
      }

      // Handle internal unsubscribe (when last subscriber leaves)
      if (cacheAction.type === `${reducerPath}/internalSubscriptions/unsubscribeQueryResult`) {
        const queryCacheKey = cacheAction.payload?.queryCacheKey;
        if (queryCacheKey) {
          // Only decrement if there are no more internal subscribers
          const requestId = cacheAction.payload?.requestId;
          if (requestId) {
            handleCacheUnsubscribe(queryCacheKey);
          }
        }
      }

      // Handle query invalidation (when tags are invalidated)
      if (cacheAction.type === `${reducerPath}/invalidateTags`) {
        // Tags invalidation will trigger refetches, cache entries will be replaced
        // We don't need to decrement here as the new fetch will increment again
      }
    }

    return result;
  };
}

/**
 * Handle cache entry removal
 */
function handleCacheRemoval(cacheKey: string): void {
  const mfeName = getMfeContext();
  if (mfeName) {
    const newCount = refCountManager.decrement(cacheKey, mfeName);
    logger.debug(`Cache removed: ${cacheKey}, ref count: ${newCount}`);
  } else {
    // If no MFE context, try to clean up all refs for this cache key
    refCountManager.clearCacheKey(cacheKey);
  }
}

/**
 * Handle cache unsubscribe
 */
function handleCacheUnsubscribe(cacheKey: string): void {
  const mfeName = getMfeContext();
  if (mfeName) {
    refCountManager.decrement(cacheKey, mfeName);
  }
}
