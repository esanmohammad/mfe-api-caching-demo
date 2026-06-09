/**
 * Shared Federated Store
 *
 * A single persistent Redux store that holds the cache for ALL federated APIs.
 * Every MFE's API hooks read/dispatch against this one store (via the federated
 * context), which is what makes the cache genuinely shared: data fetched by one
 * MFE is immediately readable by another, and an invalidation in one MFE updates
 * every MFE subscribed to that data.
 *
 * Because remotes can load lazily (after the host has already mounted), the store
 * must accept new API reducers and middleware AFTER creation. We use
 * `createDynamicMiddleware` for middleware and `replaceReducer` for reducers.
 *
 * The store is stored on `window` so all MFE bundles share one instance even when
 * Module Federation does not deduplicate this package.
 */

import {
  configureStore,
  combineReducers,
  createDynamicMiddleware,
  type Reducer,
  type Middleware,
  type EnhancedStore,
} from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { logger } from './logger';

const STORE_KEY = '__FEDERATED_QUERY_STORE__';
// Internal placeholder slice so combineReducers always has at least one reducer.
const INTERNAL_KEY = '__federated_query_internal__';

interface SharedStoreBundle {
  store: EnhancedStore;
  reducers: Record<string, Reducer>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addMiddleware: (...middlewares: Middleware<any>[]) => void;
  injectedPaths: Set<string>;
}

function getGlobal(): Record<string, unknown> {
  return (typeof window !== 'undefined' ? window : globalThis) as Record<string, unknown>;
}

function createBundle(): SharedStoreBundle {
  const dynamic = createDynamicMiddleware();
  const reducers: Record<string, Reducer> = {
    [INTERNAL_KEY]: (state: { ready: boolean } = { ready: true }) => state,
  };

  const store = configureStore({
    reducer: combineReducers(reducers),
    middleware: (getDefaultMiddleware) =>
      // RTK Query stores non-serializable values (e.g. AbortController) in some
      // internal actions; the default checks are too strict for that.
      getDefaultMiddleware({ serializableCheck: false }).concat(dynamic.middleware),
  });

  // Enables refetchOnFocus / refetchOnReconnect for every federated API.
  setupListeners(store.dispatch);

  return {
    store,
    reducers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addMiddleware: (...middlewares: Middleware<any>[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamic.addMiddleware(...(middlewares as any)),
    injectedPaths: new Set<string>(),
  };
}

function getBundle(): SharedStoreBundle {
  const g = getGlobal();
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = createBundle();
  }
  return g[STORE_KEY] as SharedStoreBundle;
}

/**
 * The single shared store backing all federated API cache.
 */
export function getSharedStore(): EnhancedStore {
  return getBundle().store;
}

/**
 * Inject an API's reducer and middleware into the shared store.
 *
 * Idempotent per reducerPath: a second call for the same path is a no-op, which
 * is what we want when several MFEs declare the same `reducerPath`.
 */
export function injectApiIntoSharedStore(
  reducerPath: string,
  reducer: Reducer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...middlewares: Middleware<any>[]
): void {
  const bundle = getBundle();

  if (bundle.injectedPaths.has(reducerPath)) {
    return;
  }

  bundle.reducers[reducerPath] = reducer;
  bundle.store.replaceReducer(combineReducers(bundle.reducers));
  if (middlewares.length > 0) {
    bundle.addMiddleware(...middlewares);
  }
  bundle.injectedPaths.add(reducerPath);

  logger.debug(`Injected "${reducerPath}" into shared store`);
}

/**
 * Whether a reducerPath has already been injected into the shared store.
 */
export function isInjectedIntoSharedStore(reducerPath: string): boolean {
  return getBundle().injectedPaths.has(reducerPath);
}

/**
 * Reset the shared store (testing only).
 */
export function resetSharedStore(): void {
  const g = getGlobal();
  delete g[STORE_KEY];
}
