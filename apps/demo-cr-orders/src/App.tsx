import { Provider } from '@dtsl/rtk-query/react';
import { store } from './store';
import { useGetOrdersQuery, Order } from './api';

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-gray-100 text-gray-600',
};

function OrdersContent() {
  const { data, isLoading, isFetching, fulfilledTimeStamp } = useGetOrdersQuery();

  return (
    <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-indigo-800">Orders MFE</h2>
          <code className="text-xs text-indigo-500">reducerPath: 'crossResourceApi' · no tags</code>
        </div>
        <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded font-mono">mfe-cr-orders</span>
      </div>

      {isFetching && !isLoading && (
        <div className="mb-3 px-3 py-2 bg-indigo-200 rounded text-sm text-indigo-800 flex items-center gap-2 font-medium">
          <span className="animate-spin">↻</span> Cross-resource rule fired — refreshing!
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      )}

      <div className="space-y-2">
        {data?.data.map((order: Order) => (
          <div key={order.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100">
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

      {fulfilledTimeStamp && (
        <div className="mt-3 pt-3 border-t border-indigo-200 text-xs text-indigo-400">
          Last fetched: <span className="font-mono font-bold text-indigo-600">{new Date(fulfilledTimeStamp).toLocaleTimeString()}</span>
          <span className="ml-1">← watch this update!</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Provider store={store} mfeName="mfe-cr-orders">
      <OrdersContent />
    </Provider>
  );
}

export default App;
