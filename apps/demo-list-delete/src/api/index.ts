/**
 * Shared API definition for demo apps
 * Uses federated-query for transparent MFE support
 */

import { createApi, fetchBaseQuery } from "federated-query/react";

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
  reducerPath: "demoApi",
  mfeOptions: { mfeName: "demo-list-delete" },
  baseQuery: fetchBaseQuery({ baseUrl: "http://localhost:4000/api" }),
  tagTypes: ["Item", "ItemStats"],
  endpoints: (builder) => ({
    // SHARED: This endpoint is used by all demo MFEs
    // The API is slow (3.5 seconds) to clearly show coalescing
    getItems: builder.query<ItemsResponse, void>({
      query: () => "/v1/items",
      // providesTags: (result) =>
      //   result
      //     ? [
      //         ...result.data.map(({ id }) => ({ type: 'Item' as const, id })),
      //         { type: 'Item', id: 'LIST' },
      //       ]
      //     : [{ type: 'Item', id: 'LIST' }],
    }),

    // Delete mutation - specific to this MFE
    deleteItem: builder.mutation<void, number>({
      query: (id) => ({
        url: `/v1/items/${id}`,
        method: "DELETE",
      }),
      // invalidatesTags: [{ type: 'Item', id: 'LIST' }, { type: 'ItemStats' }],
    }),
  }),
});

export const { useGetItemsQuery, useDeleteItemMutation } = api;
