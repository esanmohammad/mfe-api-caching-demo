/**
 * Demo Host Shell Application
 *
 * Simple demo showcasing @dtsl/rtk-query features:
 * 1. Request Coalescing - 4 MFEs load same data = 1 API call
 * 2. Shared Cache - Data loaded by one MFE available to others
 * 3. Unified Invalidation - Mutation in one MFE updates all others
 *
 * The API is intentionally slow (3-4 seconds) to make coalescing visible.
 */

import React, { Suspense, useState, useEffect } from "react";

// Lazy load the remote microfrontends
const DemoListDelete = React.lazy(() => import("demoListDelete/App"));
const DemoListAdd = React.lazy(() => import("demoListAdd/App"));
const DemoListUpdate = React.lazy(() => import("demoListUpdate/App"));

function LoadingSpinner({ name, color }: { name: string; color: string }) {
  return (
    <div
      className={`flex items-center justify-center py-16 bg-${color}-50 rounded-lg border-2 border-${color}-200`}
    >
      <div
        className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${color}-600`}
      ></div>
      <span className={`ml-3 text-${color}-600`}>Loading {name}...</span>
    </div>
  );
}

function MfeErrorFallback({ name }: { name: string }) {
  return (
    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg text-center min-h-[300px] flex items-center justify-center">
      <div>
        <p className="text-red-600 font-medium">Failed to load {name}</p>
        <p className="text-red-400 text-sm mt-1">
          Make sure the MFE is running
        </p>
      </div>
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

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function App() {
  const [apiStats, setApiStats] = useState<{ totalRequests: number } | null>(
    null,
  );
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // useEffect(() => {
  //   const statsInterval = setInterval(async () => {
  //     try {
  //       const res = await fetch('http://localhost:4000/api/stats');
  //       const data = await res.json();
  //       setApiStats(data);
  //     } catch {
  //       setApiStats(null);
  //     }
  //   }, 500);

  //   const timeInterval = setInterval(() => {
  //     setElapsed(Math.floor((Date.now() - startTime) / 1000));
  //   }, 1000);

  //   return () => {
  //     clearInterval(statsInterval);
  //     clearInterval(timeInterval);
  //   };
  // }, [startTime]);

  const resetCounter = async () => {
    try {
      await fetch("http://localhost:4000/api/reset", { method: "POST" });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">@dtsl/rtk-query Demo</h1>
          <p className="text-indigo-200 mt-1">
            3 MFEs sharing one slow API - Watch the magic of request coalescing!
          </p>
        </div>
      </header>

      {/* MFE Grid */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Delete MFE */}
          <ErrorBoundary fallback={<MfeErrorFallback name="Delete MFE" />}>
            <Suspense
              fallback={<LoadingSpinner name="Delete MFE" color="red" />}
            >
              <DemoListDelete />
            </Suspense>
          </ErrorBoundary>

          {/* Add MFE */}
          <ErrorBoundary fallback={<MfeErrorFallback name="Add MFE" />}>
            <Suspense
              fallback={<LoadingSpinner name="Add MFE" color="green" />}
            >
              <DemoListAdd />
            </Suspense>
          </ErrorBoundary>

          {/* Update MFE */}
          <ErrorBoundary fallback={<MfeErrorFallback name="Update MFE" />}>
            <Suspense
              fallback={<LoadingSpinner name="Update MFE" color="blue" />}
            >
              <DemoListUpdate />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
        <p>
          All 3 MFEs use the same{" "}
          <code className="bg-gray-200 px-1 rounded">
            reducerPath: 'demoApi'
          </code>{" "}
          - this enables shared cache & request coalescing via @dtsl/rtk-query
        </p>
      </footer>
    </div>
  );
}

export default App;
