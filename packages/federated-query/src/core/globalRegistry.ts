/**
 * Global Registry
 * Singleton pattern for sharing API instances and stores across MFEs
 */

import type { Api, BaseQueryFn, EndpointDefinitions } from '@reduxjs/toolkit/query';
import type { Store, EnhancedStore } from '@reduxjs/toolkit';
import type { BaseQueryRouter } from './baseQueryRouter';
import { refCountManager } from './refCountManager';
import { requestTracker } from './requestTracker';

const REGISTRY_KEY = '__FEDERATED_QUERY_REGISTRY__';

/**
 * Snapshot of config provided at API creation time.
 * Used to detect divergence and merge tagTypes across MFEs.
 */
export interface ApiConfigSnapshot {
  keepUnusedDataFor?: number;
  tagTypes?: readonly string[];
}

export interface ApiRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: Api<BaseQueryFn, EndpointDefinitions, string, any>;
  store: Store | EnhancedStore;
  subscribers: Set<string>;
  createdAt: number;
  createdBy: string;
  configSnapshot?: ApiConfigSnapshot;
  baseQueryRouter?: BaseQueryRouter;
}

export interface GlobalRegistry {
  apis: Map<string, ApiRegistryEntry>;
  stores: Map<string, Store | EnhancedStore>;
  initialized: boolean;
}

/**
 * Get the global registry (creates if not exists)
 */
export function getGlobalRegistry(): GlobalRegistry {
  const globalObj = typeof window !== 'undefined' ? window : globalThis;

  if (!(globalObj as Record<string, unknown>)[REGISTRY_KEY]) {
    (globalObj as Record<string, unknown>)[REGISTRY_KEY] = createRegistry();
  }

  return (globalObj as Record<string, unknown>)[REGISTRY_KEY] as GlobalRegistry;
}

/**
 * Create a new registry instance
 */
function createRegistry(): GlobalRegistry {
  return {
    apis: new Map(),
    stores: new Map(),
    initialized: true,
  };
}

/**
 * Register an API instance
 */
export function registerApi(
  reducerPath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: Api<BaseQueryFn, EndpointDefinitions, string, any>,
  store: Store | EnhancedStore,
  createdBy: string,
  configSnapshot?: ApiConfigSnapshot,
  baseQueryRouter?: BaseQueryRouter
): void {
  const registry = getGlobalRegistry();

  if (registry.apis.has(reducerPath)) {
    console.warn(
      `[federated-query] API with reducerPath "${reducerPath}" already registered. Using existing instance.`
    );
    return;
  }

  const entry: ApiRegistryEntry = {
    api,
    store,
    subscribers: new Set([createdBy]),
    createdAt: Date.now(),
    createdBy,
    configSnapshot,
    baseQueryRouter,
  };

  registry.apis.set(reducerPath, entry);
  registry.stores.set(reducerPath, store);

  console.debug(`[federated-query] Registered API: ${reducerPath} (created by ${createdBy})`);
}

/**
 * Get a registered API instance
 */
export function getRegisteredApi(
  reducerPath: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Api<BaseQueryFn, EndpointDefinitions, string, any> | undefined {
  const registry = getGlobalRegistry();
  return registry.apis.get(reducerPath)?.api;
}

/**
 * Get a registered store
 */
export function getRegisteredStore(reducerPath: string): Store | EnhancedStore | undefined {
  const registry = getGlobalRegistry();
  return registry.stores.get(reducerPath);
}

/**
 * Check if an API is registered
 */
export function isApiRegistered(reducerPath: string): boolean {
  const registry = getGlobalRegistry();
  return registry.apis.has(reducerPath);
}

/**
 * Get the config snapshot for a registered API
 */
export function getRegisteredConfig(reducerPath: string): ApiConfigSnapshot | undefined {
  const registry = getGlobalRegistry();
  return registry.apis.get(reducerPath)?.configSnapshot;
}

/**
 * Update the config snapshot for a registered API (e.g. after merging tagTypes)
 */
export function updateConfigSnapshot(reducerPath: string, patch: Partial<ApiConfigSnapshot>): void {
  const registry = getGlobalRegistry();
  const entry = registry.apis.get(reducerPath);
  if (entry && entry.configSnapshot) {
    entry.configSnapshot = { ...entry.configSnapshot, ...patch };
  }
}

/**
 * Get the base query router for a registered API
 */
export function getRegisteredRouter(reducerPath: string): BaseQueryRouter | undefined {
  const registry = getGlobalRegistry();
  return registry.apis.get(reducerPath)?.baseQueryRouter;
}

/**
 * Subscribe an MFE to an API
 */
export function subscribe(reducerPath: string, mfeName: string): void {
  const registry = getGlobalRegistry();
  const entry = registry.apis.get(reducerPath);

  if (entry) {
    entry.subscribers.add(mfeName);
    console.debug(
      `[federated-query] ${mfeName} subscribed to ${reducerPath} (${entry.subscribers.size} subscribers)`
    );
  }
}

/**
 * Unsubscribe an MFE from an API
 */
export function unsubscribe(reducerPath: string, mfeName: string): void {
  const registry = getGlobalRegistry();
  const entry = registry.apis.get(reducerPath);

  if (entry) {
    entry.subscribers.delete(mfeName);
    console.debug(
      `[federated-query] ${mfeName} unsubscribed from ${reducerPath} (${entry.subscribers.size} subscribers)`
    );

    // Clean up ref counts for this MFE
    refCountManager.cleanupMfe(mfeName);
  }
}

/**
 * Get all reducer paths with registered APIs
 */
export function getRegisteredReducerPaths(): string[] {
  const registry = getGlobalRegistry();
  return Array.from(registry.apis.keys());
}

/**
 * Get registry statistics for debugging
 */
export function getRegistryStats(): {
  apiCount: number;
  storeCount: number;
  apis: Record<
    string,
    {
      subscribers: string[];
      subscriberCount: number;
      createdAt: number;
      createdBy: string;
    }
  >;
  requestStats: ReturnType<typeof requestTracker.getStats>;
  refCountStats: ReturnType<typeof refCountManager.getStats>;
} {
  const registry = getGlobalRegistry();
  const apis: Record<
    string,
    {
      subscribers: string[];
      subscriberCount: number;
      createdAt: number;
      createdBy: string;
    }
  > = {};

  for (const [path, entry] of registry.apis) {
    apis[path] = {
      subscribers: Array.from(entry.subscribers),
      subscriberCount: entry.subscribers.size,
      createdAt: entry.createdAt,
      createdBy: entry.createdBy,
    };
  }

  return {
    apiCount: registry.apis.size,
    storeCount: registry.stores.size,
    apis,
    requestStats: requestTracker.getStats(),
    refCountStats: refCountManager.getStats(),
  };
}

/**
 * Reset registry (for testing)
 */
export function resetRegistry(): void {
  const globalObj = typeof window !== 'undefined' ? window : globalThis;
  delete (globalObj as Record<string, unknown>)[REGISTRY_KEY];
  refCountManager.reset();
  requestTracker.reset();
}
