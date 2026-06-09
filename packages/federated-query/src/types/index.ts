/**
 * Type exports
 * Re-exports all RTK Query types for 100% API compatibility
 */

// Core types from RTK Query
export type {
  // Base query types
  BaseQueryFn,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  FetchArgs,

  // API types
  Api,
  EndpointDefinitions,
  EndpointBuilder,

  // Query types
  QueryDefinition,
  MutationDefinition,
  QueryArgFrom,
  ResultTypeFrom,

  // Tag types
  TagDescription,
} from '@reduxjs/toolkit/query';

// Internal types
export type { MfeCreateApiOptions } from '../createApi';
export type { MfeFetchBaseQueryArgs } from '../fetchBaseQuery';
export type { MfeProviderProps } from '../Provider';
export type { RefCountState, RefCountStats } from '../core/refCountManager';
export type { TrackedRequest, RequestTrackerStats } from '../core/requestTracker';
export type { ApiRegistryEntry, GlobalRegistry } from '../core/globalRegistry';
export type { EnhancedBaseQueryOptions } from '../enhancers/baseQueryEnhancer';
export type { SerializerOptions } from '../enhancers/serializerEnhancer';
