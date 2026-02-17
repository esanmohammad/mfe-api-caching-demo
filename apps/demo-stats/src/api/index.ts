/**
 * Shared API definition for demo apps
 * Uses @dtsl/rtk-query for transparent MFE support
 *
 * Stats are derived from the items cache - no separate API call needed!
 * This demonstrates how shared cache enables efficient data usage across MFEs.
 */

import { createApi, fetchBaseQuery } from '@dtsl/rtk-query/react';

export interface Item {
  id: number;
  name: string;
  description: string;
  price: number;
}

export interface ItemsResponse {
  data: Item[];
  total: number;
  fetchedAt: string;
}

export const api = createApi({
  // IMPORTANT: Same reducerPath across all MFEs enables cache sharing
  reducerPath: 'demoApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),
  tagTypes: ['Item'],
  endpoints: (builder) => ({
    // SHARED: This endpoint is used by all demo MFEs
    // Stats MFE derives its data from this shared cache
    // No separate stats API call - just reuses the items data!
    getItems: builder.query<ItemsResponse, void>({
      query: () => '/v1/items',
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Item' as const, id })),
              { type: 'Item', id: 'LIST' },
            ]
          : [{ type: 'Item', id: 'LIST' }],
    }),
  }),
});

export const { useGetItemsQuery } = api;
