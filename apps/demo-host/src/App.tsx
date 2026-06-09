/**
 * Demo Host — showcases all federated-query invalidation patterns
 * across 7 separate MFE apps sharing cache via the global registry.
 */

import React, { Suspense } from "react";
import { Provider } from "federated-query/react";
import { useTransferAccountMutation } from "./api";

const DemoListDelete = React.lazy(() => import("demoListDelete/App"));
const DemoListAdd = React.lazy(() => import("demoListAdd/App"));
const DemoListUpdate = React.lazy(() => import("demoListUpdate/App"));
const DemoCrUsers = React.lazy(() => import("demoCrUsers/App"));
const DemoCrOrders = React.lazy(() => import("demoCrOrders/App"));
const DemoTbUsers = React.lazy(() => import("demoTbUsers/App"));
const DemoTbOrders = React.lazy(() => import("demoTbOrders/App"));

function Spinner({ name, color }: { name: string; color: string }) {
  return (
    <div className={`flex items-center justify-center py-12 bg-${color}-50 rounded-lg border-2 border-${color}-200`}>
      <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${color}-600`} />
      <span className={`ml-3 text-${color}-600 text-sm`}>Loading {name}...</span>
    </div>
  );
}

function ErrorFallback({ name }: { name: string }) {
  return (
    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg text-center py-12 text-red-500 text-sm">
      Failed to load {name} — is it running?
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function MFE({ name, color, children }: { name: string; color: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={<ErrorFallback name={name} />}>
      <Suspense fallback={<Spinner name={name} color={color} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// "Do Both" button lives in the host to show cross-app tag invalidation
function DoBothButton() {
  const [transferAccount, { isLoading }] = useTransferAccountMutation();

  const handleDoBoth = () => {
    transferAccount({ id: 1, name: `Alice #${Date.now().toString().slice(-3)}` });
  };

  return (
    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-300 text-center">
      <p className="font-bold text-purple-800 text-sm mb-1">Host — Do Both</p>
      <code className="block text-xs text-purple-600 bg-purple-100 rounded px-2 py-1 mb-3">
        invalidatesTags: ['User', 'Order']
      </code>
      <p className="text-xs text-gray-500 mb-3">✅ Users refreshes · ✅ Orders refreshes</p>
      <button onClick={handleDoBoth} disabled={isLoading}
        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
        {isLoading ? 'Working...' : '🔀 Invalidate Both Tags'}
      </button>
    </div>
  );
}

function App() {
  return (
    <Provider mfeName="demo-host">
      <div className="min-h-screen bg-gray-100">
        <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold">federated-query Demo</h1>
            <p className="text-indigo-200 mt-1">
              7 separate MFE apps · 3 invalidation patterns · 1 shared cache
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">

          {/* Section 1: URL-Based Auto-Invalidation */}
          <section>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-gray-800">URL-Based Auto-Invalidation</h2>
              <p className="text-sm text-gray-500">3 MFEs, 1 slow API — add/delete/update auto-refreshes all panels with no tags</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MFE name="Delete MFE" color="red"><DemoListDelete /></MFE>
              <MFE name="Add MFE" color="green"><DemoListAdd /></MFE>
              <MFE name="Update MFE" color="blue"><DemoListUpdate /></MFE>
            </div>
          </section>

          <hr className="border-gray-300" />

          {/* Section 2: Cross-Resource Invalidation */}
          <section>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-gray-800">Cross-Resource Invalidation</h2>
              <p className="text-sm text-gray-500">
                Rename a user → orders refresh automatically via{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">urlInvalidationManager.invalidateOn()</code> · no tags
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MFE name="Users MFE" color="purple"><DemoCrUsers /></MFE>
              <MFE name="Orders MFE" color="indigo"><DemoCrOrders /></MFE>
            </div>
          </section>

          <hr className="border-gray-300" />

          {/* Section 3: Tag-Based Invalidation */}
          <section>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-gray-800">Tag-Based Invalidation</h2>
              <p className="text-sm text-gray-500">
                Explicit <code className="bg-gray-100 px-1 rounded text-xs">providesTags</code> /{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">invalidatesTags</code> — each button only refreshes the panels whose tags it declares
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MFE name="Users MFE" color="orange"><DemoTbUsers /></MFE>
              <DoBothButton />
              <MFE name="Orders MFE" color="teal"><DemoTbOrders /></MFE>
            </div>
          </section>

        </main>

        <footer className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-400 text-xs border-t border-gray-200 mt-4">
          All MFEs share cache via <code>window.__FEDERATED_QUERY_REGISTRY__</code> · federated-query
        </footer>
      </div>
    </Provider>
  );
}

export default App;
