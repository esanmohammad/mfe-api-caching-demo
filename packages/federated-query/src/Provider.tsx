/**
 * MFE-aware Provider
 * Wraps react-redux Provider with automatic MFE detection and cleanup
 */

import React, { useEffect, useRef, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import type { Store, EnhancedStore } from '@reduxjs/toolkit';
import {
  subscribe,
  unsubscribe,
  getGlobalRegistry,
  getRegisteredStore,
} from './core/globalRegistry';
import {
  setMfeContext,
  clearMfeContext,
  detectMfeName,
  isInMfeEnvironment,
} from './core/mfeContext';
import { refCountManager } from './core/refCountManager';

export interface MfeProviderProps {
  /**
   * Redux store instance
   */
  store: Store | EnhancedStore;
  /**
   * React children
   */
  children: ReactNode;
  /**
   * Explicit MFE name (auto-detected if not provided)
   */
  mfeName?: string;
  /**
   * Disable MFE features (run as standalone app)
   */
  standalone?: boolean;
}

/**
 * MFE-aware Redux Provider
 *
 * This is a drop-in replacement for react-redux's Provider.
 * It automatically detects MFE context and manages subscriptions
 * for proper cache sharing and cleanup.
 *
 * @example
 * ```typescript
 * import { Provider } from 'federated-query/react';
 * import { store } from './store';
 *
 * function App() {
 *   return (
 *     <Provider store={store}>
 *       <MyComponent />
 *     </Provider>
 *   );
 * }
 * ```
 *
 * @example
 * // With explicit MFE name
 * <Provider store={store} mfeName="checkout-app">
 *   <CheckoutApp />
 * </Provider>
 *
 * @example
 * // Standalone mode (no MFE features)
 * <Provider store={store} standalone>
 *   <StandaloneApp />
 * </Provider>
 */
export function Provider({
  store,
  children,
  mfeName,
  standalone = false,
}: MfeProviderProps): React.ReactElement {
  const mountedRef = useRef(false);
  const resolvedMfeName = mfeName ?? detectMfeName();

  useEffect(() => {
    // Skip MFE setup in standalone mode
    if (standalone) {
      return;
    }

    // Skip if already mounted (strict mode double-invoke protection)
    if (mountedRef.current) {
      return;
    }
    mountedRef.current = true;

    // Set MFE context for request tracking
    setMfeContext(resolvedMfeName);

    // Subscribe to all registered APIs
    const reducerPaths = getReducerPathsFromStore(store);
    for (const path of reducerPaths) {
      subscribe(path, resolvedMfeName);
    }

    console.debug(
      `[federated-query] Provider mounted: ${resolvedMfeName} (${reducerPaths.length} APIs)`
    );

    // Cleanup on unmount
    return () => {
      console.debug(`[federated-query] Provider unmounting: ${resolvedMfeName}`);

      // Unsubscribe from all APIs
      for (const path of reducerPaths) {
        unsubscribe(path, resolvedMfeName);
      }

      // Clean up reference counts
      refCountManager.cleanupMfe(resolvedMfeName);

      // Clear context
      clearMfeContext();
      mountedRef.current = false;
    };
  }, [store, resolvedMfeName, standalone]);

  // Determine which store to use
  const effectiveStore = standalone ? store : getEffectiveStore(store, resolvedMfeName);

  return <ReduxProvider store={effectiveStore}>{children}</ReduxProvider>;
}

/**
 * Get the effective store (shared or local)
 */
function getEffectiveStore(
  localStore: Store | EnhancedStore,
  mfeName: string
): Store | EnhancedStore {
  // If not in MFE environment, use local store
  if (!isInMfeEnvironment()) {
    return localStore;
  }

  // Try to get shared store for the same reducer paths
  const reducerPaths = getReducerPathsFromStore(localStore);

  for (const path of reducerPaths) {
    const sharedStore = getRegisteredStore(path);
    if (sharedStore) {
      console.debug(
        `[federated-query] ${mfeName} using shared store for ${path}`
      );
      return sharedStore;
    }
  }

  // No shared store found, use local
  return localStore;
}

/**
 * Extract reducer paths from a store
 */
function getReducerPathsFromStore(store: Store | EnhancedStore): string[] {
  const state = store.getState() as Record<string, unknown>;
  const registry = getGlobalRegistry();

  // Find reducer paths that are registered APIs
  return Object.keys(state).filter((key) => registry.apis.has(key));
}

// Re-export the original Provider for edge cases
export { Provider as BaseProvider } from 'react-redux';
