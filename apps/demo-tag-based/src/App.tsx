/**
 * Tag-Based Invalidation Host
 *
 * Loads two separate MFE apps:
 *   - mfe-tb-users (port 4010) — has Rename button (invalidatesTags: [User])
 *   - mfe-tb-orders (port 4011) — has Create Order button (invalidatesTags: [Order])
 *
 * Each MFE only refreshes when its own tag is invalidated.
 * The host's "Do Both" button invalidates [User, Order] → both refresh.
 *
 * URL auto-invalidation is DISABLED — only explicit tags drive updates.
 */

import React, { Suspense } from 'react';
import { Provider } from 'federated-query/react';
import { useTransferAccountMutation } from './api';

const TbUsers = React.lazy(() => import('demoTbUsers/App'));
const TbOrders = React.lazy(() => import('demoTbOrders/App'));

function Spinner({ color }: { color: string }) {
  return (
    <div className={`flex items-center justify-center py-12 bg-${color}-50 rounded-lg border-2 border-${color}-200`}>
      <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${color}-600`} />
    </div>
  );
}

// "Do Both" button — lives in the host, invalidates BOTH User and Order tags
function DoBothButton() {
  const [transferAccount, { isLoading }] = useTransferAccountMutation();

  const handleDoBoth = () => {
    transferAccount({ id: 1, name: `Alice #${Date.now().toString().slice(-3)}` });
  };

  return (
    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-300 text-center">
      <p className="font-bold text-purple-800 mb-1">Do Both (Host MFE)</p>
      <code className="block text-xs text-purple-600 bg-purple-100 rounded px-2 py-1 mb-3">
        invalidatesTags: ['User', 'Order']
      </code>
      <p className="text-xs text-gray-600 mb-3">
        ✅ Users refreshes · ✅ Orders refreshes
      </p>
      <button
        onClick={handleDoBoth}
        disabled={isLoading}
        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
      >
        {isLoading ? 'Working...' : '🔀 Invalidate Both Tags'}
      </button>
      <p className="text-xs text-purple-400 mt-2">dispatched from the host app's store</p>
    </div>
  );
}

function App() {
  return (
    <Provider mfeName="demo-tag-based-host">
      <div className="min-h-screen bg-gray-100">
        <header className="bg-gradient-to-r from-orange-500 to-teal-600 text-white shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold">Tag-Based Invalidation</h1>
            <p className="text-orange-100 mt-1">
              Three separate apps · Tags control exactly which app refreshes
            </p>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          {/* Two MFE apps + host button */}
          <div className="grid grid-cols-3 gap-4">
            <Suspense fallback={<Spinner color="orange" />}>
              <TbUsers />
            </Suspense>

            <DoBothButton />

            <Suspense fallback={<Spinner color="teal" />}>
              <TbOrders />
            </Suspense>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Try it:</strong>
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li><strong>✏️ Rename</strong> in Users MFE → only Users "Last fetched" changes</li>
              <li><strong>🛒 Create Order</strong> in Orders MFE → only Orders "Last fetched" changes</li>
              <li><strong>🔀 Do Both</strong> (host) → <em>both</em> timestamps change</li>
            </ul>
            <p className="mt-2 text-xs text-amber-600">All three are separate apps. Tags cross app boundaries via the shared global registry.</p>
          </div>
        </main>
      </div>
    </Provider>
  );
}

export default App;
