/**
 * Demo List Add MFE
 *
 * Shows item list with ADD capability.
 * Demonstrates:
 * - Request coalescing (same API call shared with other MFEs)
 * - Cache invalidation (add triggers refresh in all MFEs)
 */

import { useState } from 'react';
import { Provider } from 'federated-query/react';
import { useGetItemsQuery, useAddItemMutation, Item } from './api';

const MFE_NAME = 'demo-list-add';

function App() {
  return (
    <Provider mfeName={MFE_NAME}>
      <ListContent />
    </Provider>
  );
}

function ListContent() {
  const { data, isLoading, isFetching, error } = useGetItemsQuery();
  const [addItem, { isLoading: isAdding }] = useAddItemMutation();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    try {
      await addItem({
        name,
        description,
        price: parseFloat(price),
      }).unwrap();
      console.log(`[${MFE_NAME}] Added item - all MFEs will refresh!`);
      setName('');
      setDescription('');
      setPrice('');
      setShowForm(false);
    } catch (err) {
      console.error(`[${MFE_NAME}] Add failed:`, err);
    }
  };

  return (
    <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-green-800">Add Items</h2>
          <p className="text-sm text-green-600">Add new items to the list</p>
        </div>
        <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-mono">
          {MFE_NAME}
        </span>
      </div>

      {/* Add Button / Form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span> Add New Item
        </button>
      ) : (
        <form onSubmit={handleAdd} className="mb-4 p-3 bg-white rounded-lg border border-green-200">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isAdding}
                className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isAdding ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600 mb-4"></div>
          <p className="text-green-600 font-medium">Loading items...</p>
          <p className="text-sm text-green-400 mt-1">API takes ~3.5 seconds</p>
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
            <div className="mb-3 px-3 py-2 bg-green-100 rounded text-sm text-green-700 flex items-center">
              <span className="animate-spin mr-2">&#8635;</span>
              Refreshing from shared cache...
            </div>
          )}

          <div className="space-y-2">
            {data.data.map((item: Item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-green-100"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{item.name}</h3>
                  <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-green-200 text-xs text-green-500">
            {data.total} items | Fetched: {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
