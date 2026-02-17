/**
 * MFE Profile App
 *
 * Demonstrates:
 * - Shared cache access (data loaded by other MFEs is available here)
 * - Request coalescing (duplicate requests are deduplicated)
 * - Unified invalidation (updates from other MFEs reflect here)
 *
 * Uses @dtsl/rtk-query for transparent MFE support with standard RTK Query API
 */

import React, { useEffect, useState } from 'react';
import { Provider, getRegistryStats } from '@dtsl/rtk-query/react';
import { store } from './store';
import {
  useGetUserQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
  type User,
} from './api';

const MFE_NAME = 'mfe-profile';

function App() {
  return (
    <Provider store={store} mfeName={MFE_NAME}>
      <ProfileContent />
    </Provider>
  );
}

function ProfileContent() {
  const [selectedUserId, setSelectedUserId] = useState<number>(1);

  useEffect(() => {
    console.log(`[${MFE_NAME}] Mounted with @dtsl/rtk-query`);
    return () => {
      console.log(`[${MFE_NAME}] Unmounted`);
    };
  }, []);

  return (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-blue-800">
          Profile MFE
        </h2>
        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
          {MFE_NAME}
        </span>
      </div>

      <UserSelector
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
      />

      <UserProfile userId={selectedUserId} />

      <DebugInfo />
    </div>
  );
}

function UserSelector({
  selectedUserId,
  onSelectUser,
}: {
  selectedUserId: number;
  onSelectUser: (id: number) => void;
}) {
  // This query will be COALESCED with the same query from other MFEs
  const { data, isLoading, isFetching } = useGetUsersQuery({ page: 1, limit: 10 });

  if (isLoading) {
    return <div className="text-gray-500 mb-4">Loading users...</div>;
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select User {isFetching && <span className="text-blue-500">(syncing...)</span>}
      </label>
      <select
        value={selectedUserId}
        onChange={(e) => onSelectUser(Number(e.target.value))}
        className="w-full p-2 border rounded-md bg-white"
      >
        {data?.data.map((user: User) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.email})
          </option>
        ))}
      </select>
    </div>
  );
}

function UserProfile({ userId }: { userId: number }) {
  // This query uses the SHARED CACHE
  // If MFE-Orders already loaded this user, no new request is made!
  const { data: user, isLoading, isFetching, error } = useGetUserQuery(userId);
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.name);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-red-600">Failed to load user</p>
      </div>
    );
  }

  const handleUpdateName = async () => {
    try {
      await updateUser({ id: userId, data: { name: editName } }).unwrap();
      console.log(`[${MFE_NAME}] User updated successfully`);
    } catch (err) {
      console.error(`[${MFE_NAME}] Update failed:`, err);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      {isFetching && (
        <div className="text-xs text-blue-500 mb-2 flex items-center">
          <span className="animate-spin mr-1">&#8635;</span> Syncing with shared cache...
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
          {user.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{user.name}</h3>
          <p className="text-gray-500">{user.email}</p>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Edit Name</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 p-2 border rounded-md"
            placeholder="Enter new name"
          />
          <button
            onClick={handleUpdateName}
            disabled={isUpdating || editName === user.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Updates here will automatically appear in other MFEs!
        </p>
      </div>
    </div>
  );
}

function DebugInfo() {
  const [stats, setStats] = useState<ReturnType<typeof getRegistryStats> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getRegistryStats());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs">
      <h4 className="font-medium text-gray-700 mb-2">Debug Info (@dtsl/rtk-query)</h4>
      <div className="space-y-1 text-gray-600">
        <p>Active APIs: <span className="font-mono">{stats?.apiCount ?? 0}</span></p>
        {stats && Object.entries(stats.apis).map(([reducerPath, api]) => (
          <p key={reducerPath} className="ml-2">
            - {reducerPath}: {api.subscriberCount} subscriber(s)
          </p>
        ))}
      </div>
    </div>
  );
}

export default App;
