import { Provider } from 'federated-query/react';
import { store } from './store';
import { useGetOrdersQuery, useCreateOrderMutation, Order } from './api';

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-gray-100 text-gray-600',
};

function OrdersContent() {
  const { data, isLoading, isFetching, fulfilledTimeStamp } = useGetOrdersQuery();
  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();

  const handleCreateOrder = () => {
    createOrder({ userId: 1, items: [{ productId: 1, quantity: 1 }] });
  };

  return (
    <div className="p-4 bg-teal-50 rounded-lg border-2 border-teal-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-teal-800">Orders MFE</h2>
          <code className="text-xs text-teal-500">providesTags: ['Order'] · invalidatesTags: ['Order']</code>
        </div>
        <span className="text-xs bg-teal-200 text-teal-800 px-2 py-1 rounded font-mono">mfe-tb-orders</span>
      </div>

      {isFetching && !isLoading && (
        <div className="mb-3 px-3 py-2 bg-teal-200 rounded text-sm text-teal-800 flex items-center gap-2">
          <span className="animate-spin">↻</span> Order tag invalidated — refreshing!
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-200 border-t-teal-600" />
        </div>
      )}

      <div className="space-y-2 mb-3">
        {data?.data.map((order: Order) => (
          <div key={order.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-teal-100">
            <div>
              <p className="font-medium text-gray-800">Order #{order.id}</p>
              <p className="text-xs text-gray-500">User #{order.userId} · ${order.total.toFixed(2)}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100'}`}>
              {order.status}
            </span>
          </div>
        ))}
      </div>

      <button onClick={handleCreateOrder} disabled={isCreating}
        className="w-full py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
        {isCreating ? 'Creating...' : '🛒 Create Order'}
      </button>

      {fulfilledTimeStamp && (
        <div className="mt-3 pt-3 border-t border-teal-200 text-xs text-teal-400">
          Last fetched: <span className="font-mono font-bold text-teal-600">{new Date(fulfilledTimeStamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Provider store={store} mfeName="mfe-tb-orders">
      <OrdersContent />
    </Provider>
  );
}

export default App;
