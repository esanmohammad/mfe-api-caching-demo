/**
 * Enhanced fetchBaseQuery
 * Wraps RTK Query's fetchBaseQuery with MFE support while maintaining 100% API compatibility
 */

import {
  fetchBaseQuery as rtkFetchBaseQuery,
  type FetchBaseQueryArgs,
  type FetchBaseQueryError,
  type FetchBaseQueryMeta,
  type BaseQueryFn,
  type FetchArgs,
} from '@reduxjs/toolkit/query';
import { getMfeContext, generateRequestId } from './core/mfeContext';
import { requestTracker } from './core/requestTracker';
import { generateCacheKey } from './enhancers/serializerEnhancer';

/**
 * Extended options for MFE-aware fetchBaseQuery
 */
export interface MfeFetchBaseQueryArgs extends FetchBaseQueryArgs {
  /**
   * MFE-specific configuration
   */
  mfeOptions?: {
    /**
     * Disable MFE features entirely
     */
    standalone?: boolean;
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
     * Add request ID header
     * @default false
     */
    addRequestIdHeader?: boolean;
    /**
     * Custom header name for request ID
     * @default 'X-Request-ID'
     */
    requestIdHeaderName?: string;
  };
}

/**
 * Create a fetch-based base query with MFE support
 *
 * This is a drop-in replacement for RTK Query's fetchBaseQuery.
 * It adds MFE headers and request tracking automatically.
 *
 * @example
 * ```typescript
 * import { createApi, fetchBaseQuery } from 'federated-query';
 *
 * const api = createApi({
 *   baseQuery: fetchBaseQuery({
 *     baseUrl: '/api',
 *     prepareHeaders: (headers) => {
 *       headers.set('Authorization', `Bearer ${token}`);
 *       return headers;
 *     },
 *   }),
 *   endpoints: (builder) => ({ ... }),
 * });
 * ```
 */
export function fetchBaseQuery(
  options?: MfeFetchBaseQueryArgs
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, object, FetchBaseQueryMeta> {
  const {
    mfeOptions,
    prepareHeaders: originalPrepareHeaders,
    ...rtkOptions
  } = options ?? {};

  const {
    standalone = false,
    addMfeHeader = true,
    mfeHeaderName = 'X-MFE-Source',
    addRequestIdHeader = false,
    requestIdHeaderName = 'X-Request-ID',
  } = mfeOptions ?? {};

  // Create enhanced prepareHeaders function
  const enhancedPrepareHeaders: FetchBaseQueryArgs['prepareHeaders'] = (
    headers,
    api
  ) => {
    // Helper to finalize headers
    const finalizeHeaders = (h: Headers | void | undefined): Headers => {
      const finalHeaders = h ?? headers;
      if (!standalone) {
        addMfeHeaders(
          finalHeaders,
          addMfeHeader,
          mfeHeaderName,
          addRequestIdHeader,
          requestIdHeaderName
        );
      }
      return finalHeaders;
    };

    // Call original prepareHeaders first
    if (originalPrepareHeaders) {
      const result = originalPrepareHeaders(headers, api);
      if (result && 'then' in result) {
        return (result as Promise<Headers | void>).then(finalizeHeaders);
      }
      return finalizeHeaders(result as Headers | void);
    }

    return finalizeHeaders(headers);
  };

  // Create the base fetch query
  const baseFetch = rtkFetchBaseQuery({
    ...rtkOptions,
    prepareHeaders: enhancedPrepareHeaders,
  });

  // If standalone, return base fetch directly
  if (standalone) {
    return baseFetch;
  }

  // Wrap with tracking (coalescing is handled in createApi's baseQuery enhancer)
  return async (args, api, extraOptions) => {
    const requestId = generateRequestId();
    const cacheKey = generateCacheKey(api.endpoint, args);
    const mfeName = getMfeContext();

    // Track request start (detailed tracking for debugging)
    requestTracker.startRequest(requestId, {
      cacheKey,
      endpoint: api.endpoint,
      type: api.type,
      timestamp: Date.now(),
      mfeSource: mfeName,
    });

    try {
      const result = await baseFetch(args, api, extraOptions);

      // Track completion
      requestTracker.completeRequest(requestId);

      return result;
    } catch (error) {
      // Track failure
      requestTracker.failRequest(requestId, error);
      throw error;
    }
  };
}

/**
 * Add MFE-specific headers
 */
function addMfeHeaders(
  headers: Headers,
  addMfeHeader: boolean,
  mfeHeaderName: string,
  addRequestIdHeader: boolean,
  requestIdHeaderName: string
): void {
  const mfeName = getMfeContext();

  if (addMfeHeader && mfeName) {
    headers.set(mfeHeaderName, mfeName);
  }

  if (addRequestIdHeader) {
    headers.set(requestIdHeaderName, generateRequestId());
  }

  // Always add timestamp for debugging
  headers.set('X-Request-Timestamp', Date.now().toString());
}

// Re-export the original fetchBaseQuery for edge cases
export { fetchBaseQuery as originalFetchBaseQuery } from '@reduxjs/toolkit/query';
