/**
 * Demo Stats MFE
 *
 * Shows item statistics derived from the shared items cache.
 * Demonstrates:
 * - READ-ONLY from cache - does NOT trigger any API calls
 * - Stats only appear when other MFEs have loaded data
 * - Updates automatically when mutations invalidate cache
 */

import { Provider, getRegistryStats } from "@dtsl/rtk-query/react";
import { useSelector } from "react-redux";
import { store, RootState } from "./store";
import { api } from "./api";
import { useEffect, useState, useMemo } from "react";

const MFE_NAME = "demo-stats";

function App() {
  return (
    <Provider store={store} mfeName={MFE_NAME}>
      <StatsContent />
    </Provider>
  );
}

// Selector to read items from cache WITHOUT triggering a fetch
const selectItemsFromCache = api.endpoints.getItems.select();

function StatsContent() {
  // READ FROM CACHE ONLY - no API call triggered!
  const itemsResult = useSelector((state: RootState) =>
    selectItemsFromCache(state),
  );
  const [registryStats, setRegistryStats] = useState<ReturnType<
    typeof getRegistryStats
  > | null>(null);

  const items = itemsResult?.data;
  const status = itemsResult?.status;
  // Status-based checks (selectors don't have isLoading/isFetching like hooks)
  const isLoading = status === "pending";
  const hasData = status === "fulfilled" && !!items;

  // Derive stats from cached items (computed, not fetched)
  const stats = useMemo(() => {
    if (!items?.data) return null;
    const totalValue = items.data.reduce((sum, item) => sum + item.price, 0);
    return {
      totalItems: items.data.length,
      totalValue: totalValue.toFixed(2),
      averagePrice:
        items.data.length > 0
          ? (totalValue / items.data.length).toFixed(2)
          : "0.00",
    };
  }, [items]);

  useEffect(() => {
    const interval = setInterval(() => {
      // setRegistryStats(getRegistryStats());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // No data in cache yet - waiting for other MFEs to load
  const hasNoData = !hasData && !isLoading;

  return (
    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-purple-800">Statistics</h2>
          <p className="text-sm text-purple-600">Read-only from shared cache</p>
        </div>
        <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded font-mono">
          {MFE_NAME}
        </span>
      </div>

      {/* Waiting for cache */}
      {hasNoData && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-4">&#128203;</div>
          <p className="text-purple-600 font-medium">Waiting for data...</p>
          <p className="text-sm text-purple-400 mt-1">
            Stats will appear when other MFEs load items
          </p>
          <p className="text-xs text-purple-300 mt-2">
            (This MFE does NOT make API calls)
          </p>
        </div>
      )}

      {/* Loading State (when cache is being fetched by other MFEs) */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mb-4"></div>
          <p className="text-purple-600 font-medium">
            Other MFEs loading data...
          </p>
          <p className="text-sm text-purple-400 mt-1">
            Reading from shared cache
          </p>
        </div>
      )}

      {/* Stats Loaded */}
      {stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {stats.totalItems}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Total Items
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100 text-center">
              <div className="text-3xl font-bold text-purple-600">
                ${stats.totalValue}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Total Value
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100 text-center">
              <div className="text-3xl font-bold text-purple-600">
                ${stats.averagePrice}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Avg Price
              </div>
            </div>
          </div>

          {/* Registry Debug Info */}
          <div className="bg-white p-3 rounded-lg border border-purple-100">
            <h3 className="text-sm font-semibold text-purple-800 mb-2">
              Cache Registry
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                APIs registered:{" "}
                <span className="font-mono font-bold">
                  {registryStats?.apiCount ?? 0}
                </span>
              </p>
              {registryStats &&
                Object.entries(registryStats.apis).map(([path, api]) => (
                  <div key={path} className="ml-2 p-2 bg-purple-50 rounded">
                    <p className="font-medium">{path}</p>
                    <p className="text-purple-600">
                      {api.subscriberCount} MFE(s) sharing cache
                    </p>
                    <p className="text-gray-500 text-xs">
                      Subscribers: {api.subscribers.join(", ")}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-purple-200 text-xs text-purple-500">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
              NO API CALLS - cache read only
            </span>
            {items && (
              <span className="ml-2">
                | Cache updated:{" "}
                {new Date(items.fetchedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
