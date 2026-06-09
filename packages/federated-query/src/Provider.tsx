/**
 * MFE-aware Provider
 *
 * Renders two react-redux Providers:
 *   1. The MFE's OWN store on the default context — for its own local state.
 *      Untouched by this library. Optional; a trivial store is used if omitted.
 *   2. The single shared federated store on the federated context — backing all
 *      federated API hooks, so the cache is shared across MFEs.
 *
 * In standalone mode no federated wrapping happens: the API is vanilla RTK Query
 * on the default context, so the consumer's own store is used as-is.
 */

import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { configureStore, type Store, type EnhancedStore } from '@reduxjs/toolkit';
import {
  subscribe,
  unsubscribe,
  getRegisteredReducerPaths,
} from './core/globalRegistry';
import { setMfeContext, clearMfeContext, detectMfeName } from './core/mfeContext';
import { refCountManager } from './core/refCountManager';
import { getSharedStore } from './core/sharedStore';
import { getFederatedContext } from './core/federatedContext';
import { logger } from './core/logger';

export interface MfeProviderProps {
  /**
   * The MFE's own Redux store, for its own local (non-API) state. Optional — if
   * omitted, a trivial store is created. The federated API cache lives in the
   * shared store and does NOT need to be added here.
   */
  store?: Store | EnhancedStore;
  /**
   * React children
   */
  children: ReactNode;
  /**
   * Explicit MFE name (auto-detected if not provided)
   */
  mfeName?: string;
  /**
   * Disable MFE features (run as a standalone app with the provided store).
   */
  standalone?: boolean;
}

/**
 * Create a minimal local store for MFEs that don't bring their own.
 */
function createDefaultLocalStore(): EnhancedStore {
  return configureStore({
    reducer: { __federated_query_local__: (state: Record<string, never> = {}) => state },
  });
}

/**
 * MFE-aware Redux Provider — a drop-in replacement for react-redux's Provider.
 *
 * @example
 * ```tsx
 * import { Provider } from 'federated-query/react';
 *
 * // No local state? No store needed:
 * <Provider mfeName="checkout"><App /></Provider>
 *
 * // Have local state? Pass your own store (the API cache is NOT added to it):
 * <Provider store={localStore} mfeName="checkout"><App /></Provider>
 * ```
 */
export function Provider({
  store,
  children,
  mfeName,
  standalone = false,
}: MfeProviderProps): React.ReactElement {
  const mountedRef = useRef(false);
  const resolvedMfeName = mfeName ?? detectMfeName();

  // Stable local store for this MFE's own state.
  const localStore = useMemo(
    () => store ?? createDefaultLocalStore(),
    [store],
  );

  useEffect(() => {
    if (standalone) return;
    if (mountedRef.current) return; // StrictMode double-invoke guard
    mountedRef.current = true;

    setMfeContext(resolvedMfeName);

    const reducerPaths = getRegisteredReducerPaths();
    for (const path of reducerPaths) {
      subscribe(path, resolvedMfeName);
    }
    logger.debug(
      `Provider mounted: ${resolvedMfeName} (${reducerPaths.length} federated APIs)`,
    );

    return () => {
      logger.debug(`Provider unmounting: ${resolvedMfeName}`);
      for (const path of getRegisteredReducerPaths()) {
        unsubscribe(path, resolvedMfeName);
      }
      refCountManager.cleanupMfe(resolvedMfeName);
      clearMfeContext();
      mountedRef.current = false;
    };
  }, [resolvedMfeName, standalone]);

  // Standalone: vanilla single-store Provider (default context).
  if (standalone) {
    return <ReduxProvider store={localStore}>{children}</ReduxProvider>;
  }

  // Federated: local store (default context) wrapping the shared store
  // (federated context, used by all API hooks).
  const FederatedContext = getFederatedContext();
  const sharedStore = getSharedStore();

  return (
    <ReduxProvider store={localStore}>
      <ReduxProvider store={sharedStore} context={FederatedContext}>
        {children}
      </ReduxProvider>
    </ReduxProvider>
  );
}

// Re-export the original Provider for edge cases
export { Provider as BaseProvider } from 'react-redux';
