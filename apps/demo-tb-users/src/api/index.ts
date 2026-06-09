/**
 * Users MFE — Tag-Based Demo
 *
 * Declares User tags. The renameUser mutation only invalidates
 * User tags, so only this panel refreshes when rename is called.
 * URL auto-invalidation is disabled to keep the demo pure.
 */

import { createApi, fetchBaseQuery } from 'federated-query/react';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export const api = createApi({
  reducerPath: 'tagDemoApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),
  mfeOptions: { enableUrlInvalidation: false, mfeName: 'mfe-tb-users' },
  tagTypes: ['User', 'Order'],
  endpoints: (builder) => ({
    getUsers: builder.query<PaginatedResponse<User>, void>({
      query: () => '/v1/users',
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),

    // Only invalidates User tags → only this panel refreshes
    renameUser: builder.mutation<User, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `/v1/users/${id}`,
        method: 'PATCH',
        body: { name },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'User' as const, id },
        { type: 'User' as const, id: 'LIST' },
      ],
    }),
  }),
});

export const { useGetUsersQuery, useRenameUserMutation } = api;
