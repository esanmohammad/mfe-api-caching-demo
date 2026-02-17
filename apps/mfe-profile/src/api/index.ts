/**
 * mfe-profile API definition
 * Uses @dtsl/rtk-query for transparent MFE support
 */

import { createApi, fetchBaseQuery } from '@dtsl/rtk-query/react';
import type { User, PaginatedResponse, UpdateUserRequest } from './types';

export const api = createApi({
  // IMPORTANT: Same reducerPath across all MFEs enables cache sharing
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),
  tagTypes: ['User', 'Order', 'Product'],
  endpoints: (builder) => ({
    // SHARED: Also used by mfe-orders and mfe-admin
    getUser: builder.query<User, number>({
      query: (id) => `/v1/users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),

    // SHARED: Also used by mfe-admin
    getUsers: builder.query<PaginatedResponse<User>, { page: number; limit: number }>({
      query: ({ page, limit }) => `/v1/users?page=${page}&limit=${limit}`,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'User', id: 'LIST' },
            ]
          : [{ type: 'User', id: 'LIST' }],
    }),

    // Profile-specific mutation
    updateUser: builder.mutation<User, UpdateUserRequest>({
      query: ({ id, data }) => ({
        url: `/v1/users/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetUserQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
} = api;

// Re-export types for convenience
export type { User, PaginatedResponse, UpdateUserRequest } from './types';
