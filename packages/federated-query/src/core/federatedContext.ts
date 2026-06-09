/**
 * Federated react-redux context
 *
 * The federated API cache lives in a single shared store (see sharedStore.ts).
 * RTK Query's generated hooks must read/dispatch against THAT store, while each
 * MFE keeps its own store for its own local state on react-redux's default
 * context. To do that we bind the API hooks to a dedicated context.
 *
 * Crucially, the context object and its bound hooks are stored on `window` so
 * that every MFE bundle shares ONE context instance even when Module Federation
 * does not deduplicate this package. If each bundle created its own context,
 * a Provider in bundle A could not satisfy hooks generated in bundle B.
 */

import { createContext, type Context } from 'react';
import {
  createDispatchHook,
  createSelectorHook,
  createStoreHook,
  type ReactReduxContextValue,
} from 'react-redux';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReduxContext = Context<ReactReduxContextValue<any, any> | null>;

export interface FederatedHooks {
  useDispatch: ReturnType<typeof createDispatchHook>;
  useSelector: ReturnType<typeof createSelectorHook>;
  useStore: ReturnType<typeof createStoreHook>;
}

interface FederatedContextBundle {
  context: ReduxContext;
  hooks: FederatedHooks;
}

const CONTEXT_KEY = '__FEDERATED_QUERY_CONTEXT__';

function getGlobal(): Record<string, unknown> {
  return (typeof window !== 'undefined' ? window : globalThis) as Record<string, unknown>;
}

function createBundle(): FederatedContextBundle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const context = createContext<ReactReduxContextValue<any, any> | null>(null);
  // Helps React DevTools and avoids anonymous-context confusion across bundles.
  context.displayName = 'FederatedQueryContext';

  return {
    context,
    hooks: {
      useDispatch: createDispatchHook(context),
      useSelector: createSelectorHook(context),
      useStore: createStoreHook(context),
    },
  };
}

function getBundle(): FederatedContextBundle {
  const g = getGlobal();
  if (!g[CONTEXT_KEY]) {
    g[CONTEXT_KEY] = createBundle();
  }
  return g[CONTEXT_KEY] as FederatedContextBundle;
}

/**
 * The shared react-redux context used by all federated API hooks.
 */
export function getFederatedContext(): ReduxContext {
  return getBundle().context;
}

/**
 * react-redux hooks bound to the federated context, for `reactHooksModule`.
 */
export function getFederatedHooks(): FederatedHooks {
  return getBundle().hooks;
}
