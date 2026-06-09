/**
 * Demo List Delete MFE
 *
 * Shows item list with DELETE capability.
 * Demonstrates:
 * - Request coalescing (same API call shared with other MFEs)
 * - Cache invalidation (delete triggers refresh in all MFEs)
 */

import { Provider } from 'federated-query/react';
import { store } from './store';
import { useGetItemsQuery, useDeleteItemMutation, Item } from './api';

const MFE_NAME = 'demo-list-delete';

function App() {
  return (
    <Provider store={store} mfeName={MFE_NAME}>
      <ListContent />
    </Provider>
  );
}

function ListContent() {
  const { data, isLoading, isFetching, error } = useGetItemsQuery();
  const [deleteItem, { isLoading: isDeleting }] = useDeleteItemMutation();

  const handleDelete = async (id: number) => {
    try {
      await deleteItem(id).unwrap();
      console.log(`[${MFE_NAME}] Deleted item ${id} - all MFEs will refresh!`);
    } catch (err) {
      console.error(`[${MFE_NAME}] Delete failed:`, err);
    }
  };

  return (
    <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-red-800">Delete Items</h2>
          <p className="text-sm text-red-600">Click trash icon to delete</p>
        </div>
        <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded font-mono">
          {MFE_NAME}
        </span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600 mb-4"></div>
          <p className="text-red-600 font-medium">Loading items...</p>
          <p className="text-sm text-red-400 mt-1">API takes ~3.5 seconds</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded">
          Failed to load items. Is the API running?
        </div>
      )}

      {/* Data Loaded */}
      {data && (
        <>
          {isFetching && !isLoading && (
            <div className="mb-3 px-3 py-2 bg-red-100 rounded text-sm text-red-700 flex items-center">
              <span className="animate-spin mr-2">&#8635;</span>
              Refreshing from shared cache...
            </div>
          )}

          <div className="space-y-2">
            {data.data.map((item: Item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-red-100"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{item.name}</h3>
                  <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isDeleting}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                  title="Delete item"
                >
                  {isDeleting ? (
                    <span className="animate-spin">&#8635;</span>
                  ) : (
                    <span className="text-xl">&#128465;</span>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-red-200 text-xs text-red-500">
            {data.total} items | Fetched: {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
