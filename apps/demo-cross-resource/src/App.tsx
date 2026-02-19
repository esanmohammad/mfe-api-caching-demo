/**
 * Cross-Resource Invalidation Host
 *
 * Loads two completely separate MFE apps side by side:
 *   - mfe-cr-users (port 4008) — its own store, its own Provider
 *   - mfe-cr-orders (port 4009) — its own store, its own Provider
 *
 * The magic: renaming a user in the left app automatically refreshes
 * the orders in the right app — even though they are separate bundles
 * with separate Redux stores.
 *
 * How? @dtsl/rtk-query's global registry (window.__DTSL_RTK_QUERY_REGISTRY__)
 * makes both apps share one store when they use the same reducerPath.
 * The cross-resource rule in mfe-cr-users fires the middleware that
 * invalidates mfe-cr-orders' getOrders query.
 */

import React, { Suspense } from 'react';

const CrUsers = React.lazy(() => import('demoCrUsers/App'));
const CrOrders = React.lazy(() => import('demoCrOrders/App'));

function Spinner({ color }: { color: string }) {
  return (
    <div className={`flex items-center justify-center py-12 bg-${color}-50 rounded-lg border-2 border-${color}-200`}>
      <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${color}-600`} />
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Cross-Resource Invalidation</h1>
          <p className="text-purple-200 mt-1">
            Two separate apps · Rename a user → orders refresh automatically · Zero tags
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Rule explanation */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Rule configured in <code className="bg-gray-100 px-1 rounded">mfe-cr-users</code> at startup:</p>
          <pre className="bg-gray-50 border rounded p-3 text-xs font-mono">
{`urlInvalidationManager.invalidateOn(
  '/api/v1/users/*',     // when Users MFE mutates a user...
  ['/api/v1/orders',     // ...mfe-cr-orders cache is invalidated
   '/api/v1/orders/*']   //    even though it's a separate app!
);`}
          </pre>
        </div>

        {/* Two separate MFE apps */}
        <div className="grid grid-cols-2 gap-4">
          <Suspense fallback={<Spinner color="purple" />}>
            <CrUsers />
          </Suspense>
          <Suspense fallback={<Spinner color="indigo" />}>
            <CrOrders />
          </Suspense>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Try it:</strong> Click ✏️ Rename on any user → watch the Orders "Last fetched" timestamp change.
          Both panels are <strong>separate React apps</strong> with separate stores — the refresh crosses app boundaries via the global registry.
        </div>
      </main>
    </div>
  );
}

export default App;
