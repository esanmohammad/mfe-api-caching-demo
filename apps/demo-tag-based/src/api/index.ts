/**
 * Host API — Tag-Based Demo
 *
 * Same reducerPath as the two MFE apps → shares their store via global registry.
 *
 * IMPORTANT: Do NOT define getUsers here.
 * The host's createApi runs before the lazy sub-MFEs load (module evaluation order).
 * If the host defines getUsers without providesTags, injectEndpoints({overrideExisting: false})
 * will prevent demo-tb-users from registering its tagged version — breaking tag invalidation.
 *
 * Only define transferAccount here (the "Do Both" mutation).
 * demo-tb-users will inject getUsers with providesTags: [User].
 * demo-tb-orders will inject getOrders with providesTags: [Order].
 */

import { createApi, fetchBaseQuery } from 'federated-query/react';

export interface User {
  id: number;
  name: string;
  email: string;
}

export const api = createApi({
  reducerPath: 'tagDemoApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),
  mfeOptions: { enableUrlInvalidation: false },
  tagTypes: ['User', 'Order'],
  endpoints: (builder) => ({
    // Invalidates BOTH tags → both sub-MFE apps refresh
    transferAccount: builder.mutation<User, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `/v1/users/${id}`,
        method: 'PATCH',
        body: { name },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'User' as const, id },
        { type: 'User' as const, id: 'LIST' },
        { type: 'Order' as const, id: 'LIST' },
      ],
    }),
  }),
});

export const { useTransferAccountMutation } = api;
