# federated-query

A drop-in replacement for [RTK Query](https://redux-toolkit.js.org/rtk-query/overview) that makes Micro-Frontend (MFE) data sharing transparent.

When multiple MFEs use `federated-query` with the same `reducerPath`, they automatically share a single cache, deduplicate in-flight requests, and propagate cache invalidations to each other — with zero configuration and full RTK Query API compatibility.

```diff
- import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
+ import { createApi, fetchBaseQuery } from 'federated-query/react';
```

That's the entire migration.

---

## The problem

In a standard MFE setup, each micro-frontend has its own Redux store and RTK Query cache. When three MFEs all need `GET /users/1`, you get three separate network requests, three copies of the data in memory, and no way for a mutation in one MFE to automatically refresh the others.

`federated-query` eliminates all three problems without requiring you to restructure your apps.

---

## Features

- **Request coalescing** — concurrent requests for the same resource across MFEs collapse into a single network call
- **Shared cache** — all MFEs reading `reducerPath: 'api'` share one store and one cache
- **Unified invalidation** — a mutation in any MFE invalidates cached data in all of them
- **URL-based auto-invalidation** — mutations automatically invalidate related queries based on REST URL patterns; no manual tag coordination required
- **Cross-resource invalidation** — declare that a change to `/users/*` should also bust `/orders/*`, in one line
- **Base query routing** — each MFE can point its endpoints at a different backend URL while still sharing the cache
- **Reference counting** — prevents cache eviction while any MFE still holds a subscription
- **100% RTK Query API compatible** — every hook, option, and pattern you already use continues to work

---

## Installation

```bash
npm install federated-query
# or
yarn add federated-query
```

**Peer dependencies:**

```json
{
  "@reduxjs/toolkit": "^2.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-redux": "^9.0.0"
}
```

---

## Quick start

### 1. Define your API (identical to RTK Query)

```typescript
// api.ts
import { createApi, fetchBaseQuery } from 'federated-query/react';

export const api = createApi({
  reducerPath: 'api', // use the same reducerPath across all MFEs
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  mfeOptions: { mfeName: 'mfe-profile' }, // optional: names this MFE for tracing
  endpoints: (builder) => ({
    getUser: builder.query({
      query: (id) => `/users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    updateUser: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation } = api;
```

### 2. Wrap your MFE with `Provider`

The federated cache lives in a store the library manages — you do **not** add the API
reducer/middleware to your own store. Pass a store only if your MFE has its own local
state; it stays fully isolated from the shared cache.

```tsx
// App.tsx
import { Provider } from 'federated-query/react';

export function App() {
  return (
    // No local state? No store needed:
    <Provider mfeName="mfe-profile">
      <YourComponents />
    </Provider>
  );
}
```

> **Migrating from a single-app RTK Query setup?** Remove `api.reducer` and
> `api.middleware` from your `configureStore` call — `federated-query` owns the cache
> store now. Keep your store only for your own (non-API) slices and pass it to
> `<Provider store={…}>`.

### 3. Use hooks as normal

```tsx
import { useGetUserQuery, useUpdateUserMutation } from './api';

function UserProfile({ userId }: { userId: number }) {
  const { data: user, isLoading } = useGetUserQuery(userId);
  const [updateUser] = useUpdateUserMutation();

  if (isLoading) return <p>Loading…</p>;

  return (
    <>
      <h1>{user.name}</h1>
      <button onClick={() => updateUser({ id: userId, name: 'New name' })}>
        Rename
      </button>
    </>
  );
}
```

Any other MFE that calls `useGetUserQuery(userId)` after this mutation will automatically receive the updated data — no extra wiring needed.

---

## URL-based auto-invalidation

Tag coordination across independent MFE codebases is painful. `federated-query` offers a second invalidation mechanism that requires no tags at all: it watches mutation URLs and automatically refetches queries whose URLs match standard REST patterns.

| Mutation | Automatically refetches |
|---|---|
| `POST /users` | `GET /users` |
| `PUT /users/123` | `GET /users`, `GET /users/123` |
| `PATCH /users/123` | `GET /users`, `GET /users/123` |
| `DELETE /users/123` | `GET /users`, `GET /users/123` |

This works out of the box for any endpoint using `fetchBaseQuery`. No tags, no `invalidatesTags`, no shared constants between teams.

### Cross-resource invalidation

When a relationship spans resource types, declare it once at startup:

```typescript
import { urlInvalidationManager } from 'federated-query';

// Renaming a user should also refresh order history (which shows the username)
urlInvalidationManager.invalidateOn('/users/*', ['/orders', '/orders/*']);

// Deleting a product should bust inventory counts
urlInvalidationManager.invalidateOn('/products/*', ['/inventory/*'], ['DELETE']);
```

Pattern syntax:

| Pattern | Matches |
|---|---|
| `/users/*` | `/users/123`, `/users/abc` |
| `/users/**` | `/users/123`, `/users/123/addresses/1` |
| `/api/*/items` | `/api/v1/items`, `/api/v2/items` |

ID detection is automatic — numeric, UUID, and MongoDB ObjectId formats are all recognized.

---

## Different backends, shared cache

MFEs pointing at different services can still share a cache. Declare the same `reducerPath` in each MFE; `federated-query` creates a per-endpoint router so each query hits the right backend.

```typescript
// mfe-profile — talks to the users service
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: 'https://users.internal' }),
  endpoints: (builder) => ({
    getUser: builder.query({ query: (id) => `/users/${id}` }),
  }),
});

// mfe-orders — talks to the orders service
export const api = createApi({
  reducerPath: 'api', // same reducerPath = shared cache
  baseQuery: fetchBaseQuery({ baseUrl: 'https://orders.internal' }),
  endpoints: (builder) => ({
    getOrders: builder.query({ query: () => '/orders' }),
  }),
});

// useGetUserQuery  → GET https://users.internal/users/:id
// useGetOrdersQuery → GET https://orders.internal/orders
// Both are cached together and invalidation crosses between them.
```

When tagTypes differ between MFEs they are merged automatically. If `keepUnusedDataFor` values diverge, the first-registered value wins and a console warning is emitted.

---

## `createApi` options

All standard RTK Query options are supported. `federated-query` adds one optional namespace:

```typescript
createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: () => ({}),

  mfeOptions: {
    standalone: false,           // true → vanilla RTK Query, no sharing
    mfeName: 'mfe-profile',      // names this MFE for deterministic attribution
    enableCoalescing: true,      // deduplicate in-flight requests
    enableTracking: true,        // track requests for observability
    enableUrlInvalidation: true, // URL-based auto-invalidation
    addMfeHeader: true,          // attach X-MFE-Source to every request
    mfeHeaderName: 'X-MFE-Source',
  },
})
```

> **`keepUnusedDataFor`:** for smoother MFE mount/unmount, `federated-query` defaults
> this to **300s** (RTK Query's own default is 60s). Pass your own value to opt out.

---

## `Provider` props

```tsx
<Provider
  store={localStore}    // optional — your own store for local (non-API) state
  mfeName="mfe-profile" // recommended — used in debug output and request headers
  standalone={false}    // true → plain react-redux Provider, no federation
>
  {children}
</Provider>
```

`store` is optional: omit it and a trivial local store is created for you. Whatever you
pass is used only for your MFE's own state — the federated API cache is always kept in
the separate shared store.

---

## Debugging

```typescript
import { getRegistryStats } from 'federated-query/react';

const stats = getRegistryStats();
// {
//   apiCount: 1,
//   apis: {
//     api: {
//       subscribers: ['mfe-profile', 'mfe-orders'],
//       createdBy: 'mfe-profile',
//     }
//   },
//   requestStats: {
//     totalRequests: 42,
//     totalCoalesced: 17,   ← network calls saved
//   },
// }
```

Every request also carries an `X-MFE-Source` header so you can trace which MFE originated it in your network tab or server logs.

To enable verbose logging for URL invalidation:

```typescript
import { urlInvalidationManager } from 'federated-query';
urlInvalidationManager.setDebug(true);
```

---

## How it works (brief)

`federated-query` keeps a single shared Redux store that holds the cache for **all**
federated APIs, plus a registry of API instances — both on `window`, so they're shared
across independently bundled MFE chunks even when Module Federation doesn't deduplicate
the package. When `createApi` is called with a `reducerPath` that already exists, it
injects the new endpoints into the existing API instance (routing them to that MFE's own
base query) instead of creating a second store.

Generated hooks are bound to the shared store through a dedicated React context, so they
read and write the shared cache regardless of which MFE renders them. Your own
`<Provider store={…}>` keeps serving your MFE's local state on react-redux's default
context — the two never collide.

> **A note on reference counting.** `federated-query` tracks per-MFE subscribers for
> observability (`getRegistryStats()`). Eviction itself is handled by RTK Query's native
> subscription counting on the shared store, which already keeps data alive while any MFE
> is using it and applies `keepUnusedDataFor` once the last subscriber leaves.

---

## License

MIT © [Esan Mohammad](https://github.com/esanmohammad)
