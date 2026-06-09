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

export interface UpdateItemRequest {
  id: number;
  data: Partial<Omit<Item, "id">>;
}

export const api = createApi({
  // IMPORTANT: Same reducerPath across all MFEs enables cache sharing
  reducerPath: "demoApi",
  mfeOptions: { mfeName: "demo-list-update" },
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

    // Update mutation - specific to this MFE
    updateItem: builder.mutation<Item, UpdateItemRequest>({
      query: ({ id, data }) => ({
        url: `/v1/items/${id}`,
        method: "PATCH",
        body: data,
      }),
      // invalidatesTags: (result, error, { id }) => [
      //   { type: 'Item', id },
      //   { type: 'Item', id: 'LIST' },
      //   { type: 'ItemStats' },
      // ],
    }),
  }),
});

export const { useGetItemsQuery, useUpdateItemMutation } = api;
