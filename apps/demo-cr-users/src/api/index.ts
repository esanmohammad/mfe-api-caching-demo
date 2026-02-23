/**
 * Users MFE — Cross-Resource Demo
 *
 * Sets up the cross-resource rule so that mutating a user
 * automatically invalidates the Orders MFE's cache too.
 * No tags used anywhere.
 */

import {
  createApi,
  fetchBaseQuery,
  urlInvalidationManager,
} from "@dtsl/rtk-query/react";

// Configure cross-resource rule once at startup.
// When this MFE patches a user, the Orders MFE refreshes automatically.
urlInvalidationManager.invalidateOn("/api/v1/users/*", [
  "/api/v1/orders",
  "/api/v1/orders/*",
]);
urlInvalidationManager.setDebug(true);

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
  reducerPath: "crossResourceApi",
  baseQuery: fetchBaseQuery({ baseUrl: "http://localhost:4000/api" }),
  endpoints: (builder) => ({
    getUsers: builder.query<PaginatedResponse<User>, void>({
      query: () => "/v1/users",
    }),
    updateUser: builder.mutation<User, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `/v1/users/${id}`,
        method: "PATCH",
        body: { name },
      }),
    }),
  }),
});

export const { useGetUsersQuery, useUpdateUserMutation } = api;
