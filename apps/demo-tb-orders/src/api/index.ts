/**
 * Orders MFE — Tag-Based Demo
 *
 * Declares Order tags. The createOrder mutation only invalidates
 * Order tags, so only this panel refreshes when an order is created.
 * URL auto-invalidation is disabled to keep the demo pure.
 */

import { createApi, fetchBaseQuery } from '@dtsl/rtk-query/react';

export interface Order {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  total: number;
  items: Array<{ productName: string; quantity: number; price: number }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export const api = createApi({
  // Same reducerPath → shares global registry store with Users MFE
  reducerPath: 'tagDemoApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),
  mfeOptions: { enableUrlInvalidation: false },
  tagTypes: ['User', 'Order'],
  endpoints: (builder) => ({
    getOrders: builder.query<PaginatedResponse<Order>, void>({
      query: () => '/v1/orders',
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Order' as const, id })),
              { type: 'Order' as const, id: 'LIST' },
            ]
          : [{ type: 'Order' as const, id: 'LIST' }],
    }),

    // Only invalidates Order tags → only this panel refreshes
    createOrder: builder.mutation<Order, { userId: number; items: Array<{ productId: number; quantity: number }> }>({
      query: (body) => ({
        url: '/v1/orders',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Order' as const, id: 'LIST' }],
    }),
  }),
});

export const { useGetOrdersQuery, useCreateOrderMutation } = api;
