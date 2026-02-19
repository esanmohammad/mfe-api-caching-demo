/**
 * Cross-Resource Invalidation Demo API
 *
 * Key concept: Two unrelated resources (users + orders) where mutating
 * one automatically refreshes the other via URL pattern rules.
 *
 * NO TAGS are used — everything is driven by urlInvalidationManager.
 */

import { createApi, fetchBaseQuery, urlInvalidationManager } from '@dtsl/rtk-query/react';

// ============================================================
// Configure cross-resource invalidation rule ONCE at startup
// ============================================================
//
// "When any user is mutated (POST/PUT/PATCH/DELETE on /api/v1/users/*),
//  also invalidate the orders queries."
//
// This is the magic line that links Users MFE → Orders MFE.
// Without this, orders would never refresh when users change.
//
urlInvalidationManager.invalidateOn(
  '/api/v1/users/*',           // Source: any mutation on a specific user
  ['/api/v1/orders',           // Target: invalidate orders list
   '/api/v1/orders/*']         // Target: invalidate any specific order
);

urlInvalidationManager.setDebug(true); // Log invalidation events to console

// ============================================================
// Type definitions
// ============================================================

export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
}

export interface Order {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// Shared API — same reducerPath means shared cache across MFEs
// ============================================================

export const api = createApi({
  reducerPath: 'crossResourceApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api' }),

  // IMPORTANT: No tagTypes defined — we rely purely on URL invalidation!
  // This demonstrates that cross-resource works WITHOUT any explicit tags.

  endpoints: (builder) => ({
    // ── Users "MFE" endpoints ────────────────────────────────────────
    // These would live in mfe-users in a real MFE setup.

    getUsers: builder.query<PaginatedResponse<User>, void>({
      query: () => '/v1/users',
      // providesTags: intentionally omitted — URL invalidation handles it
    }),

    updateUser: builder.mutation<User, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `/v1/users/${id}`,
        method: 'PATCH',
        body: { name },
      }),
      // invalidatesTags: intentionally omitted — URL invalidation handles it
      // The cross-resource rule above ensures orders also refresh!
    }),

    // ── Orders "MFE" endpoints ───────────────────────────────────────
    // These would live in mfe-orders in a real MFE setup.

    getOrders: builder.query<PaginatedResponse<Order>, void>({
      query: () => '/v1/orders',
      // providesTags: intentionally omitted — URL invalidation handles it
    }),
  }),
});

export const {
  useGetUsersQuery,
  useUpdateUserMutation,
  useGetOrdersQuery,
} = api;
