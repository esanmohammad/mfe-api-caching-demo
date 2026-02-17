/**
 * UserCard Component
 *
 * A reusable component that displays user information.
 * Can be used standalone or embedded in other MFEs.
 * Uses local API hooks from @dtsl/rtk-query
 */

import React from 'react';
import { useGetUserQuery } from '../api';

interface UserCardProps {
  userId: number;
  compact?: boolean;
  showEmail?: boolean;
}

export function UserCard({ userId, compact = false, showEmail = true }: UserCardProps) {
  const { data: user, isLoading, isFetching, error } = useGetUserQuery(userId);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${compact ? 'p-2' : 'p-4'} bg-white rounded-lg shadow`}>
        <div className="flex items-center gap-3">
          <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} rounded-full bg-gray-200`}></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            {showEmail && <div className="h-3 bg-gray-200 rounded w-32"></div>}
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} bg-red-50 rounded-lg border border-red-200`}>
        <p className="text-red-600 text-sm">User not found</p>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'p-2' : 'p-4'} bg-white rounded-lg shadow relative`}>
      {isFetching && (
        <div className="absolute top-1 right-1">
          <span className="animate-spin text-blue-500 text-xs">&#8635;</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className={`${
            compact ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-lg'
          } rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold`}
        >
          {user.name.charAt(0)}
        </div>
        <div>
          <h4 className={`font-semibold ${compact ? 'text-sm' : ''}`}>
            {user.name}
          </h4>
          {showEmail && (
            <p className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
              {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserCard;
