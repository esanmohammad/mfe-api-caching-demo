<div align="center">

# federated-query

### One cache. Every micro-frontend. Zero configuration.

**A drop-in replacement for [RTK Query](https://redux-toolkit.js.org/rtk-query/overview) that makes data sharing across independently-deployed micro-frontends completely transparent.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![RTK Query](https://img.shields.io/badge/RTK%20Query-2.x-764abc.svg)](https://redux-toolkit.js.org/rtk-query/overview)
[![Module Federation](https://img.shields.io/badge/Module%20Federation-ready-f53.svg)](https://module-federation.io/)

```diff
- import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
+ import { createApi, fetchBaseQuery } from 'federated-query/react';
```

*That's the entire migration. Your hooks, endpoints, and options all keep working.*

</div>

---

## The problem

In a typical micro-frontend setup, every MFE ships its own Redux store and its own RTK Query cache. So when three MFEs each need `GET /users/1`, you get:

- 🔴 **three** identical network requests
- 🔴 **three** copies of the same data in memory
- 🔴 a mutation in one MFE that leaves the other two showing **stale** data
- 🔴 brittle cross-team **tag coordination** to keep things in sync

## The solution

`federated-query` gives every MFE a **single shared cache** behind the exact RTK Query API you already know:

<div align="center">

```
        MFE · Profile          MFE · Orders           MFE · Admin
       useGetUser(1)          useGetUser(1)          useGetUser(1)
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   ▼
                        ┌────────────────────┐
                        │   federated-query  │
                        │   ┌──────────────┐  │
                        │   │ Shared Cache │  │   ← one entry for all MFEs
                        │   │  user #1     │  │
                        │   └──────────────┘  │
                        └─────────┬──────────┘
                                  ▼
                         GET /api/users/1          ← one request, coalesced
```

</div>

- ✅ one request serves every MFE
- ✅ one cache → consistent data everywhere
- ✅ a mutation in any MFE refreshes all of them — automatically
- ✅ drop-in: same API, no tag coordination required

---

## Features

| | Feature | What it does |
|---|---|---|
| 🔄 | **Request coalescing** | Concurrent requests for the same resource collapse into one network call |
| 📦 | **Shared cache** | Data fetched by one MFE is instantly readable by every other MFE |
| 🔔 | **Unified invalidation** | A mutation in one MFE updates the views in all of them |
| 🎯 | **URL-based auto-invalidation** | Mutations invalidate related queries by REST URL pattern — **no tags needed** |
| 🔗 | **Cross-resource rules** | Declare "a change to `/users/*` also busts `/orders/*`" in one line |
| 🧭 | **Per-endpoint routing** | MFEs on different backends can still share one cache |
| 🧩 | **100% RTK Query compatible** | Every hook, option, and pattern you already use still works |
| 🪪 | **Per-MFE attribution** | Each request is tagged with its owning MFE for tracing & metrics |

---

## Quick start

### 1 · Install

```bash
npm install federated-query
# peers: @reduxjs/toolkit ^2 · react ^18 · react-dom ^18 · react-redux ^9
```

### 2 · Define your API — exactly like RTK Query

```typescript
// api.ts
import { createApi, fetchBaseQuery } from 'federated-query/react';

export const api = createApi({
  reducerPath: 'api',                 // 🔑 use the SAME reducerPath in every MFE
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  mfeOptions: { mfeName: 'profile' }, // optional: names this MFE for tracing
  endpoints: (builder) => ({
    getUser: builder.query({ query: (id) => `/users/${id}` }),
    updateUser: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation } = api;
```

### 3 · Wrap your app

The federated cache lives in a store the library manages for you — you **don't** add the API to your own store. Pass your own store only if your MFE has its own local state (it stays fully isolated):

```tsx
import { Provider } from 'federated-query/react';

// No local state? No store needed:
<Provider mfeName="profile"><App /></Provider>

// Have local state? Pass it — the API cache is kept separate:
<Provider store={localStore} mfeName="profile"><App /></Provider>
```

### 4 · Use your hooks — nothing new to learn

```tsx
const { data, isLoading } = useGetUserQuery(1);
const [updateUser] = useUpdateUserMutation();
```

Any other MFE calling `useGetUserQuery(1)` now reads the **same cache entry** — and when `updateUser` runs, every MFE refreshes automatically. ✨

---

## Invalidation without tags

Coordinating `tagTypes` across separate codebases is painful. `federated-query` watches mutation **URLs** and refreshes matching queries using standard REST conventions — no tags, no shared constants:

| Mutation | Automatically refetches |
|---|---|
| `POST /users` | `GET /users` |
| `PUT /users/1` | `GET /users` · `GET /users/1` |
| `PATCH /users/1` | `GET /users` · `GET /users/1` |
| `DELETE /users/1` | `GET /users` · `GET /users/1` |

### Cross-resource relationships

When a change ripples across resource types, declare it once at startup:

```typescript
import { urlInvalidationManager } from 'federated-query';

// Renaming a user also refreshes order history (which shows the name)
urlInvalidationManager.invalidateOn('/users/*', ['/orders', '/orders/*']);

// Only on delete, bust inventory counts
urlInvalidationManager.invalidateOn('/products/*', ['/inventory/*'], ['DELETE']);
```

> Cross-MFE invalidation operates within a shared `reducerPath`. Use the same `reducerPath` across the MFEs that should share a cache.

---

## Different backends, one cache

MFEs can point at different services and still share a cache. Declare the same `reducerPath`; `federated-query` routes each endpoint to the backend of the MFE that defined it:

```typescript
// profile MFE → users service          orders MFE → orders service
createApi({                              createApi({
  reducerPath: 'api',                      reducerPath: 'api',        // same → shared cache
  baseQuery: fetchBaseQuery({              baseQuery: fetchBaseQuery({
    baseUrl: 'https://users.internal' }),    baseUrl: 'https://orders.internal' }),
  endpoints: (b) => ({                     endpoints: (b) => ({
    getUser: b.query({ … }) }),              getOrders: b.query({ … }) }),
});                                      });
// useGetUserQuery → users.internal · useGetOrdersQuery → orders.internal · cache & invalidation cross between them
```

---

## How it works

`federated-query` keeps one shared Redux store (on `window`, so it survives Module Federation bundle splits) holding the cache for **all** federated APIs. Generated hooks are bound to that store through a dedicated React context, while each MFE keeps its **own** store for its own local state — the two never collide.

```
┌──────────────────────────────────────────────────────────────────┐
│  Each MFE                                                          │
│    <Provider store={localStore}>          ← your own local state   │
│      <Provider store={sharedStore}>       ← federated API cache    │
│         hooks read/write the shared store, dispatch invalidations  │
└──────────────────────────────────────────────────────────────────┘
        Registry · Request Coalescer · URL Invalidation Manager
                     (window-level singletons)
```

📖 **Deep dive:** [`packages/federated-query/AGENTS.md`](packages/federated-query/AGENTS.md) · **API & recipes:** [`packages/federated-query/README.md`](packages/federated-query/README.md)

---

## This repository

A Turborepo monorepo that develops `federated-query` alongside live, federated demos that prove each capability.

```
packages/
  federated-query/     ⭐ the library
apps/
  demo-host/           Shell that composes 7 federated MFEs (one shared cache)
  demo-list-{add,delete,update}/   URL-based auto-invalidation
  demo-cr-{users,orders}/          Cross-resource invalidation (no tags)
  demo-tb-{users,orders}/          Tag-based invalidation (fine-grained)
  mock-api/            Express REST API
```

### Run the demos

```bash
yarn install
yarn demo:dev          # starts the mock API + all demo MFEs
# open http://localhost:4005  →  edit any panel, watch the others refresh
```

### Develop the library

```bash
yarn build             # build every package & app (Turbo)
cd packages/federated-query
yarn test              # vitest — unit + cross-MFE integration suite
yarn typecheck         # strict TypeScript
```

**Tech stack:** React 18 · TypeScript 5.4 · Vite 5.4 · Redux Toolkit 2.x · Module Federation · Turbo

---

## License

[MIT](LICENSE) © Esan Mohammad

<div align="center">
<sub>Built for micro-frontend architectures that deserve a single source of truth.</sub>
</div>
