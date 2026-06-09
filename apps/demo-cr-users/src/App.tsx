import { useState } from 'react';
import { Provider } from 'federated-query/react';
import { store } from './store';
import { useGetUsersQuery, useUpdateUserMutation, User } from './api';

function UsersContent() {
  const { data, isLoading, isFetching, fulfilledTimeStamp } = useGetUsersQuery();
  const [updateUser, { isLoading: isSaving }] = useUpdateUserMutation();
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleSave = async (id: number) => {
    if (!editName.trim()) return;
    await updateUser({ id, name: editName.trim() });
    setEditId(null);
    setEditName('');
  };

  return (
    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-purple-800">Users MFE</h2>
          <code className="text-xs text-purple-500">reducerPath: 'crossResourceApi' · no tags</code>
        </div>
        <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded font-mono">mfe-cr-users</span>
      </div>

      {isFetching && !isLoading && (
        <div className="mb-3 px-3 py-2 bg-purple-100 rounded text-sm text-purple-700 flex items-center gap-2">
          <span className="animate-spin">↻</span> Refreshing...
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-purple-600" />
        </div>
      )}

      <div className="space-y-2">
        {data?.data.map((user: User) => (
          <div key={user.id} className="p-3 bg-white rounded-lg border border-purple-100">
            {editId === user.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(user.id)}
                  className="flex-1 border border-purple-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  autoFocus
                />
                <button onClick={() => handleSave(user.id)} disabled={isSaving}
                  className="text-xs bg-purple-600 text-white px-3 py-1 rounded disabled:opacity-50">
                  {isSaving ? '...' : 'Save'}
                </button>
                <button onClick={() => setEditId(null)} className="text-xs bg-gray-200 px-2 py-1 rounded">✕</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <button onClick={() => { setEditId(user.id); setEditName(user.name); }}
                  className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200">
                  ✏️ Rename
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {fulfilledTimeStamp && (
        <div className="mt-3 pt-3 border-t border-purple-200 text-xs text-purple-400">
          Last fetched: <span className="font-mono font-bold text-purple-600">{new Date(fulfilledTimeStamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Provider store={store} mfeName="mfe-cr-users">
      <UsersContent />
    </Provider>
  );
}

export default App;
