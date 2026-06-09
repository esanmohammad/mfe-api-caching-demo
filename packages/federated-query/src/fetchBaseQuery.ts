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

  // Create the base fetch query.
  //
  // NOTE: We intentionally do NOT add request tracking/coalescing here. When this
  // fetchBaseQuery is used inside this package's createApi, `enhanceBaseQuery`
  // wraps it and owns tracking + coalescing — wrapping here too would double-count
  // every request. fetchBaseQuery's sole enhancement is MFE header injection via
  // prepareHeaders (above), which is robust for the fetch transport.
  return rtkFetchBaseQuery({
    ...rtkOptions,
    prepareHeaders: enhancedPrepareHeaders,
  });
}

/**
 * Add MFE-specific headers.
 *
 * The authoritative `X-MFE-Source` value is set by `enhanceBaseQuery` from a
 * captured (deterministic) MFE name and arrives here already on the headers. We
 * therefore only fall back to the (best-effort) global context when no value is
 * present yet — never overwriting the deterministic one.
 */
function addMfeHeaders(
  headers: Headers,
  addMfeHeader: boolean,
  mfeHeaderName: string,
  addRequestIdHeader: boolean,
  requestIdHeaderName: string
): void {
  if (addMfeHeader && !headers.has(mfeHeaderName)) {
    const mfeName = getMfeContext();
    if (mfeName) {
      headers.set(mfeHeaderName, mfeName);
    }
  }

  if (addRequestIdHeader) {
    headers.set(requestIdHeaderName, generateRequestId());
  }

  // Always add timestamp for debugging
  headers.set('X-Request-Timestamp', Date.now().toString());
}

// Re-export the original fetchBaseQuery for edge cases
export { fetchBaseQuery as originalFetchBaseQuery } from '@reduxjs/toolkit/query';
