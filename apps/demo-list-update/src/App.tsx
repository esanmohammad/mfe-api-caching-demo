/**
 * Demo List Update MFE
 *
 * Shows item list with UPDATE capability.
 * Demonstrates:
 * - Request coalescing (same API call shared with other MFEs)
 * - Cache invalidation (update triggers refresh in all MFEs)
 */

import { useState } from 'react';
import { Provider } from 'federated-query/react';
import { useGetItemsQuery, useUpdateItemMutation, Item } from './api';

const MFE_NAME = 'demo-list-update';

function App() {
  return (
    <Provider mfeName={MFE_NAME}>
      <ListContent />
    </Provider>
  );
}

function ListContent() {
  const { data, isLoading, isFetching, error } = useGetItemsQuery();
  const [updateItem, { isLoading: isUpdating }] = useUpdateItemMutation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    try {
      await updateItem({
        id: editingId,
        data: {
          name: editName,
          price: parseFloat(editPrice),
        },
      }).unwrap();
      console.log(`[${MFE_NAME}] Updated item ${editingId} - all MFEs will refresh!`);
      setEditingId(null);
    } catch (err) {
      console.error(`[${MFE_NAME}] Update failed:`, err);
    }
  };

  return (
    <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-blue-800">Update Items</h2>
          <p className="text-sm text-blue-600">Click edit icon to modify</p>
        </div>
        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-mono">
          {MFE_NAME}
        </span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
          <p className="text-blue-600 font-medium">Loading items...</p>
          <p className="text-sm text-blue-400 mt-1">API takes ~3.5 seconds</p>
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
            <div className="mb-3 px-3 py-2 bg-blue-100 rounded text-sm text-blue-700 flex items-center">
              <span className="animate-spin mr-2">&#8635;</span>
              Refreshing from shared cache...
            </div>
          )}

          <div className="space-y-2">
            {data.data.map((item: Item) => (
              <div
                key={item.id}
                className="bg-white p-3 rounded-lg shadow-sm border border-blue-100"
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Item name"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Price"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{item.name}</h3>
                      <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                      title="Edit item"
                    >
                      <span className="text-xl">&#9998;</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-blue-200 text-xs text-blue-500">
            {data.total} items | Fetched: {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
