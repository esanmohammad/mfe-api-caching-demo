/**
 * Base Query Enhancer
 * Wraps any base query with MFE-aware tracking and coalescing
 */

import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { requestTracker } from '../core/requestTracker';
import { refCountManager } from '../core/refCountManager';
import { getMfeContext, generateRequestId } from '../core/mfeContext';
import { generateCacheKey } from './serializerEnhancer';
import { urlInvalidationManager } from '../invalidation/urlInvalidationManager';

export interface EnhancedBaseQueryOptions {
  /**
   * Enable request coalescing
   * @default true
   */
  enableCoalescing?: boolean;
  /**
   * Enable request tracking
   * @default true
   */
  enableTracking?: boolean;
  /**
   * Add MFE source header to requests
   * @default true
   */
  addMfeHeader?: boolean;
  /**
   * Custom header name for MFE source
   * @default 'X-MFE-Source'
   */
  mfeHeaderName?: string;
  /**
   * Enable URL-based auto-invalidation
   * @default true
   */
  enableUrlInvalidation?: boolean;
  /**
   * Reducer path for the API (used for URL invalidation)
   * @default 'api'
   */
  reducerPath?: string;
}

/**
 * Enhance a base query with MFE capabilities
 */
export function enhanceBaseQuery<
  Args = FetchArgs,
  Result = unknown,
  Error = FetchBaseQueryError,
  DefinitionExtraOptions = object,
  Meta = object
>(
  baseQuery: BaseQueryFn<Args, Result, Error, DefinitionExtraOptions, Meta>,
  options: EnhancedBaseQueryOptions = {}
): BaseQueryFn<Args, Result, Error, DefinitionExtraOptions, Meta> {
  const {
    enableCoalescing = true,
    enableTracking = true,
    addMfeHeader = true,
    mfeHeaderName = 'X-MFE-Source',
    enableUrlInvalidation = true,
    reducerPath = 'api',
  } = options;

  return async (args, api, extraOptions) => {
    const mfeName = getMfeContext();
    const requestId = generateRequestId();
    const cacheKey = generateCacheKey(api.endpoint, args);
    const isQuery = api.type === 'query';

    // Request coalescing (only for queries, not mutations)
    if (enableCoalescing && isQuery) {
      const existingRequest = requestTracker.getInFlightRequest(cacheKey);
      if (existingRequest) {
        // Reuse existing in-flight request
        if (enableTracking) {
          requestTracker.recordCoalescedRequest(cacheKey, mfeName);
        }
        console.debug(
          `[@dtsl/rtk-query] Coalesced request for ${cacheKey} (${mfeName ?? 'unknown'})`
        );
        try {
          const result = await existingRequest;
          return result as { data: Result; meta?: Meta } | { error: Error; meta?: Meta };
        } catch (error) {
          return { error: error as Error };
        }
      }
    }

    // Start tracking
    if (enableTracking) {
      requestTracker.startRequest(requestId, {
        cacheKey,
        endpoint: api.endpoint,
        type: api.type,
        timestamp: Date.now(),
        mfeSource: mfeName,
      });
    }

    // Add MFE header to fetch requests
    const enhancedArgs = addMfeHeader
      ? addMfeHeaderToArgs(args, mfeName, mfeHeaderName)
      : args;

    // Create the request promise
    const requestPromise = (async () => {
      const result = await baseQuery(enhancedArgs, api, extraOptions);
      return result;
    })();

    // Register for coalescing (only queries)
    if (enableCoalescing && isQuery) {
      requestTracker.registerInFlightRequest(cacheKey, requestPromise);
    }

    try {
      const result = await requestPromise;

      // Complete tracking
      if (enableTracking) {
        requestTracker.completeRequest(requestId);
      }

      // Update ref count for successful queries (only if not already subscribed)
      if (isQuery && mfeName && 'data' in result) {
        if (!refCountManager.isSubscribed(cacheKey, mfeName)) {
          refCountManager.increment(cacheKey, mfeName);
        }
      }

      // Register query URL for auto-invalidation
      if (enableUrlInvalidation && isQuery && 'data' in result) {
        // Try to get the full URL from the response metadata first (includes baseUrl)
        const fullUrl = extractFullUrlFromResult(result as { meta?: { request?: Request } });
        const url = fullUrl || extractUrlFromArgs(args);
        if (url) {
          urlInvalidationManager.registerQuery(
            api.endpoint,
            url,
            'GET',
            reducerPath
          );
        }
      }

      return result;
    } catch (error) {
      // Fail tracking
      if (enableTracking) {
        requestTracker.failRequest(requestId, error);
      }
      throw error;
    } finally {
      // Clear in-flight request
      if (enableCoalescing && isQuery) {
        requestTracker.clearInFlightRequest(cacheKey);
      }
    }
  };
}

/**
 * Extract full URL from query result metadata
 * This gets the actual URL used (with baseUrl prepended)
 */
function extractFullUrlFromResult(result: { meta?: { request?: Request } }): string | null {
  const requestUrl = result.meta?.request?.url;
  if (requestUrl) {
    try {
      // Parse URL to get just the pathname (without origin)
      const url = new URL(requestUrl);
      return url.pathname;
    } catch {
      // If it's not a valid URL, return null
      return null;
    }
  }
  return null;
}

/**
 * Extract URL from fetch args
 */
function extractUrlFromArgs<Args>(args: Args): string | null {
  if (typeof args === 'string') {
    return args;
  }
  if (typeof args === 'object' && args !== null) {
    const fetchArgs = args as unknown as FetchArgs;
    if (typeof fetchArgs.url === 'string') {
      return fetchArgs.url;
    }
  }
  return null;
}

/**
 * Add MFE source header to fetch args
 */
function addMfeHeaderToArgs<Args>(
  args: Args,
  mfeName: string | null,
  headerName: string
): Args {
  if (!mfeName) {
    return args;
  }

  // Handle FetchArgs (object with url, headers, etc.)
  if (typeof args === 'object' && args !== null) {
    const fetchArgs = args as unknown as FetchArgs;

    // If args is a string (URL), convert to object
    if (typeof fetchArgs === 'string') {
      return {
        url: fetchArgs,
        headers: { [headerName]: mfeName },
      } as unknown as Args;
    }

    // If args has headers, merge them
    const existingHeaders = fetchArgs.headers;
    const newHeaders = existingHeaders instanceof Headers
      ? (() => {
          const h = new Headers(existingHeaders);
          h.set(headerName, mfeName);
          return h;
        })()
      : {
          ...(existingHeaders as Record<string, string> | undefined),
          [headerName]: mfeName,
        };

    return {
      ...fetchArgs,
      headers: newHeaders,
    } as unknown as Args;
  }

  return args;
}
