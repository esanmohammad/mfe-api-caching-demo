/**
 * Host API — Demo Host
 *
 * Same reducerPath as demo-tb-users and demo-tb-orders → shares their store.
 *
 * IMPORTANT: Do NOT define getUsers here.
 * The host evaluates before lazy sub-MFEs load. Defining getUsers without providesTags
 * would block demo-tb-users from injecting its tagged version (overrideExisting: false).
 *
 * Only transferAccount is needed here for the "Do Both" button.
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
