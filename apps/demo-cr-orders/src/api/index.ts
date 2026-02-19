/**
 * Orders MFE — Cross-Resource Demo
 *
 * Only knows about orders. Has no awareness of users.
 * Yet it refreshes when users are mutated — because the Users MFE
 * configured a cross-resource rule pointing to /api/v1/orders.
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
  // Same reducerPath → shares the global registry store with Users MFE
  reducerPath: 'crossResourceApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),
  endpoints: (builder) => ({
    getOrders: builder.query<PaginatedResponse<Order>, void>({
      query: () => '/v1/orders',
    }),
  }),
});

export const { useGetOrdersQuery } = api;
