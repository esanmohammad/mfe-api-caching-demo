import { useState } from 'react';
import { Provider } from '@dtsl/rtk-query/react';
import { store } from './store';
import { useGetUsersQuery, useRenameUserMutation, User } from './api';

function UsersContent() {
  const { data, isLoading, isFetching, fulfilledTimeStamp } = useGetUsersQuery();
  const [renameUser, { isLoading: isSaving }] = useRenameUserMutation();
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleSave = async (id: number) => {
    if (!editName.trim()) return;
    await renameUser({ id, name: editName.trim() });
    setEditId(null);
    setEditName('');
  };

  return (
    <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200 min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-orange-800">Users MFE</h2>
          <code className="text-xs text-orange-500">providesTags: ['User'] · invalidatesTags: ['User']</code>
        </div>
        <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded font-mono">mfe-tb-users</span>
      </div>

      {isFetching && !isLoading && (
        <div className="mb-3 px-3 py-2 bg-orange-200 rounded text-sm text-orange-800 flex items-center gap-2">
          <span className="animate-spin">↻</span> User tag invalidated — refreshing!
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-200 border-t-orange-600" />
        </div>
      )}

      <div className="space-y-2">
        {data?.data.map((user: User) => (
          <div key={user.id} className="p-3 bg-white rounded-lg border border-orange-100">
            {editId === user.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(user.id)}
                  className="flex-1 border border-orange-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  autoFocus
                />
                <button onClick={() => handleSave(user.id)} disabled={isSaving}
                  className="text-xs bg-orange-600 text-white px-3 py-1 rounded disabled:opacity-50">
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
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200">
                  ✏️ Rename
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {fulfilledTimeStamp && (
        <div className="mt-3 pt-3 border-t border-orange-200 text-xs text-orange-400">
          Last fetched: <span className="font-mono font-bold text-orange-600">{new Date(fulfilledTimeStamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Provider store={store} mfeName="mfe-tb-users">
      <UsersContent />
    </Provider>
  );
}

export default App;
