# federated-query

> **A drop-in replacement for Redux Toolkit Query with transparent Micro-Frontend (MFE) support**

Transform your independent MFEs into a unified, efficient data-sharing ecosystem with **zero configuration** and **100% API compatibility**.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Request Coalescing](#1-request-coalescing)
  - [Shared Cache](#2-shared-cache)
  - [Unified Invalidation](#3-unified-invalidation)
  - [Reference Counting](#4-reference-counting)
  - [URL-Based Auto-Invalidation](#5-url-based-auto-invalidation)
  - [Config Merging & Base Query Routing](#6-config-merging--base-query-routing)
- [API Reference](#api-reference)
- [Debugging & Observability](#debugging--observability)
- [Best Practices](#best-practices)
- [Performance](#performance)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST APPLICATION                                │
│                                                                              │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │
│  │   MFE-Profile   │   │   MFE-Orders    │   │    MFE-Admin    │           │
│  │                 │   │                 │   │                 │           │
│  │  useGetUser(1)  │   │  useGetUser(1)  │   │  useGetUser(1)  │           │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘           │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                           │
│                    ┌────────────▼────────────┐                              │
│                    │    federated-query      │                              │
│                    │  ┌──────────────────┐   │                              │
│                    │  │  Shared Cache    │   │                              │
│                    │  │  ┌────────────┐  │   │                              │
│                    │  │  │ User #1    │  │   │  ◄── Single cache entry     │
│                    │  │  └────────────┘  │   │       for ALL MFEs          │
│                    │  └──────────────────┘   │                              │
│                    └────────────┬────────────┘                              │
│                                 │                                           │
│                    ┌────────────▼────────────┐                              │
│                    │   ONE API Request       │  ◄── Request coalescing     │
│                    │   GET /api/users/1      │                              │
│                    └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Problem**: In traditional MFE architectures, each micro-frontend maintains its own Redux store and cache. This leads to:
- 🔴 Duplicate API requests for the same data
- 🔴 Inconsistent data across MFEs
- 🔴 Wasted memory with redundant caches
- 🔴 Complex state synchronization

**Solution**: `federated-query` provides transparent cache sharing across MFEs:
- ✅ Single API request serves all MFEs
- ✅ Unified cache = consistent data everywhere
- ✅ Automatic cache invalidation across MFEs
- ✅ Zero configuration, drop-in replacement

---

## Key Features

| Feature | Description |
|---------|-------------|
| **🔄 Request Coalescing** | Multiple MFEs requesting same data = 1 API call |
| **📦 Shared Cache** | Data loaded by one MFE is instantly available to others |
| **🔔 Unified Invalidation** | Mutation in one MFE updates views across ALL MFEs |
| **🛡️ Race Condition Protection** | Reference counting prevents premature cache eviction |
| **🎯 URL-Based Auto-Invalidation** | Automatic cache invalidation based on REST URL patterns |
| **🔌 100% API Compatible** | Drop-in replacement for RTK Query |
| **🎯 Auto MFE Detection** | Automatically identifies MFE context |

---

## Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           federated-query Architecture                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                              APPLICATION LAYER                              │  │
│  │                                                                             │  │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │  │
│  │   │ MFE-Profile │    │ MFE-Orders  │    │  MFE-Admin  │                    │  │
│  │   │             │    │             │    │             │                    │  │
│  │   │ createApi() │    │ createApi() │    │ createApi() │                    │  │
│  │   │ <Provider>  │    │ <Provider>  │    │ <Provider>  │                    │  │
│  │   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                    │  │
│  │          │                  │                  │                           │  │
│  └──────────┼──────────────────┼──────────────────┼───────────────────────────┘  │
│             │                  │                  │                              │
│             ▼                  ▼                  ▼                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                              INTEGRATION LAYER                              │  │
│  │                                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │  │
│  │  │   createApi     │  │    Provider     │  │    fetchBaseQuery           │ │  │
│  │  │   (Enhanced)    │  │   (MFE-aware)   │  │    (Enhanced)               │ │  │
│  │  │                 │  │                 │  │                             │ │  │
│  │  │ • API reuse     │  │ • Store sharing │  │ • Request interception      │ │  │
│  │  │ • Endpoint      │  │ • MFE context   │  │ • Coalescing logic          │ │  │
│  │  │   injection     │  │ • Cleanup       │  │ • Tracking                  │ │  │
│  │  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────────┘ │  │
│  │           │                    │                        │                  │  │
│  └───────────┼────────────────────┼────────────────────────┼──────────────────┘  │
│              │                    │                        │                     │
│              ▼                    ▼                        ▼                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                             MIDDLEWARE LAYER                               │  │
│  │                                                                             │  │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐  │  │
│  │  │ Cache Lifecycle Middleware  │  │ URL Invalidation Middleware         │  │  │
│  │  │                             │  │                                     │  │  │
│  │  │ • Tracks cache removals     │  │ • Auto-invalidates on mutations    │  │  │
│  │  │ • Decrements ref counts     │  │ • REST pattern matching            │  │  │
│  │  │ • Prevents memory leaks     │  │ • Cross-resource invalidation      │  │  │
│  │  └─────────────────────────────┘  └─────────────────────────────────────┘  │  │
│  │                                                                             │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                                CORE LAYER                                   │  │
│  │                                                                             │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │Global Registry│  │ MFE Context   │  │ RefCount     │  │ Request      │  │  │
│  │  │               │  │               │  │ Manager      │  │ Tracker      │  │  │
│  │  │ • API storage │  │ • Detection   │  │              │  │              │  │  │
│  │  │ • Store map   │  │ • URL parsing │  │ • Increment  │  │ • In-flight  │  │  │
│  │  │ • Subscribers │  │ • Federation  │  │ • Decrement  │  │ • Coalescing │  │  │
│  │  │ • Config snap │  │   detection   │  │ • Cleanup    │  │ • History    │  │  │
│  │  │ • BQ Router   │  │               │  │              │  │              │  │  │
│  │  └───────────────┘  └───────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                                             │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                     URL Invalidation Manager                        │   │  │
│  │  │              (window.__DTSL_URL_INVALIDATION_MANAGER__)             │   │  │
│  │  │                                                                     │   │  │
│  │  │  • Query URL registry          • Pattern matching (* and **)        │   │  │
│  │  │  • REST convention rules       • Cross-resource mappings            │   │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                             │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                            GLOBAL STATE (window)                           │  │
│  │                                                                             │  │
│  │    ┌─────────────────────────────────────────────────────────────────┐     │  │
│  │    │  __DTSL_RTK_QUERY_REGISTRY__:                                   │     │  │
│  │    │    apis: Map<reducerPath, ApiEntry>                              │     │  │
│  │    │    stores: Map<reducerPath, Store>                               │     │  │
│  │    │    refCounts: Map<cacheKey, { count, subscribers }>              │     │  │
│  │    │    inFlightRequests: Map<cacheKey, Promise>                      │     │  │
│  │    │                                                                  │     │  │
│  │    │  __DTSL_URL_INVALIDATION_MANAGER__:                              │     │  │
│  │    │    queryRegistry: Map<key, UrlPattern>                           │     │  │
│  │    │    crossResourceMappings: CrossResourceInvalidation[]            │     │  │
│  │    │    customRules: InvalidationRule[]                               │     │  │
│  │    └─────────────────────────────────────────────────────────────────┘     │  │
│  │                                                                             │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/federated-query/
├── src/
│   ├── index.ts                 # Main exports
│   ├── react.ts                 # React-specific exports
│   ├── createApi.ts             # Enhanced createApi wrapper
│   ├── fetchBaseQuery.ts        # Enhanced fetchBaseQuery
│   ├── Provider.tsx             # MFE-aware Provider
│   │
│   ├── core/                    # Core infrastructure
│   │   ├── globalRegistry.ts    # Singleton API/store registry + config snapshots
│   │   ├── baseQueryRouter.ts   # Routes endpoints to correct baseQuery per MFE
│   │   ├── mfeContext.ts        # MFE detection & context
│   │   ├── refCountManager.ts   # Reference counting
│   │   └── requestTracker.ts    # Request coalescing
│   │
│   ├── enhancers/               # Query enhancements
│   │   ├── baseQueryEnhancer.ts # Coalescing wrapper
│   │   └── serializerEnhancer.ts# Cache key generation
│   │
│   ├── middleware/              # Redux middleware
│   │   ├── cacheLifecycleMiddleware.ts  # Tracks cache lifecycle
│   │   └── urlInvalidationMiddleware.ts # URL-based auto-invalidation
│   │
│   ├── invalidation/            # Invalidation system
│   │   └── urlInvalidationManager.ts    # URL pattern matching & rules (window-level singleton)
│   │
│   └── types/
│       └── index.ts             # Type definitions
│
├── package.json
└── vite.config.ts
```

---

## Installation

```bash
# Using yarn
yarn add federated-query

# Using npm
npm install federated-query
```

**Peer Dependencies:**
```json
{
  "@reduxjs/toolkit": "^2.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-redux": "^9.0.0"
}
```

---

## Quick Start

### 1. Replace Imports

```diff
- import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
+ import { createApi, fetchBaseQuery } from 'federated-query/react';
```

### 2. Define Your API (Same as RTK Query)

```typescript
// api.ts
import { createApi, fetchBaseQuery } from 'federated-query/react';

export const api = createApi({
  reducerPath: 'api',  // 🔑 Use same name across ALL MFEs
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User', 'Order'],
  endpoints: (builder) => ({
    getUser: builder.query({
      query: (id) => `/users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    updateUser: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation } = api;
```

### 3. Setup Provider

```tsx
// App.tsx
import { Provider } from 'federated-query/react';
import { store } from './store';

export function App() {
  return (
    <Provider store={store} mfeName="mfe-profile">
      <YourComponents />
    </Provider>
  );
}
```

### 4. Use in Components (Same as RTK Query)

```tsx
// UserProfile.tsx
import { useGetUserQuery, useUpdateUserMutation } from './api';

export function UserProfile({ userId }) {
  const { data: user, isLoading } = useGetUserQuery(userId);
  const [updateUser] = useUpdateUserMutation();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <button onClick={() => updateUser({ id: userId, name: 'New Name' })}>
        Update
      </button>
    </div>
  );
}
```

**That's it!** Your MFEs now share cache automatically. 🎉

---

## Core Concepts

### 1. Request Coalescing

When multiple MFEs request the same data simultaneously, only **one** API call is made.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST COALESCING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Time ──────────────────────────────────────────────────────────────────►      │
│                                                                                 │
│   0ms      5ms       10ms      50ms                                             │
│    │        │         │         │                                               │
│    │        │         │         │                                               │
│    ▼        ▼         ▼         ▼                                               │
│                                                                                 │
│   ┌─────────────┐                                                               │
│   │MFE-Profile  │────► GET /users/1 ────────────────────┐                       │
│   │useGetUser(1)│      (starts request)                  │                      │
│   └─────────────┘                                        │                      │
│                                                          │                      │
│        ┌─────────────┐                                   │                      │
│        │MFE-Orders   │────► Detects in-flight ──────────┤                       │
│        │useGetUser(1)│      (reuses promise)             │                      │
│        └─────────────┘                                   │                      │
│                                                          │                      │
│             ┌─────────────┐                              │                      │
│             │MFE-Admin    │────► Detects in-flight ─────┤                       │
│             │useGetUser(1)│      (reuses promise)        │                      │
│             └─────────────┘                              │                      │
│                                                          │                      │
│                                                          ▼                      │
│                                              ┌─────────────────────┐            │
│                                              │   API Response      │            │
│                                              │   { name: "John" }  │            │
│                                              └──────────┬──────────┘            │
│                                                         │                       │
│                              ┌───────────────────────────┼───────────────────┐  │
│                              │                           │                   │  │
│                              ▼                           ▼                   ▼  │
│                        MFE-Profile                  MFE-Orders          MFE-Admin│
│                        receives data               receives data      receives data│
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                              RESULT                                     │   │
│   │                                                                         │   │
│   │    ✅ 1 HTTP Request  (instead of 3)                                    │   │
│   │    ✅ 67% bandwidth saved                                               │   │
│   │    ✅ All MFEs get identical data                                       │   │
│   │    ✅ Faster response for subsequent requesters                         │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### How It Works

```typescript
// Inside baseQueryEnhancer.ts
async function enhancedBaseQuery(args, api, extraOptions) {
  const cacheKey = generateCacheKey(api.endpoint, args);

  // Check for existing in-flight request
  const existingRequest = requestTracker.getInFlightRequest(cacheKey);

  if (existingRequest) {
    // COALESCE! Reuse the existing request
    return await existingRequest;
  }

  // No existing request, start a new one
  const promise = originalBaseQuery(args, api, extraOptions);
  requestTracker.registerInFlightRequest(cacheKey, promise);

  try {
    return await promise;
  } finally {
    requestTracker.clearInFlightRequest(cacheKey);
  }
}
```

---

### 2. Shared Cache

All MFEs using the same `reducerPath` share a single Redux store and cache.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SHARED CACHE MECHANISM                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                              STEP 1: First MFE Registers                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │   MFE-Profile calls:                                                    │   │
│   │                                                                         │   │
│   │   createApi({                                                           │   │
│   │     reducerPath: 'api',  ◄─── Key identifier                            │   │
│   │     endpoints: (builder) => ({                                          │   │
│   │       getUser: builder.query({...}),                                    │   │
│   │       updateUser: builder.mutation({...})                               │   │
│   │     })                                                                  │   │
│   │   })                                                                    │   │
│   │                                                                         │   │
│   │                         │                                               │   │
│   │                         ▼                                               │   │
│   │              ┌─────────────────────┐                                    │   │
│   │              │  Global Registry    │                                    │   │
│   │              │                     │                                    │   │
│   │              │  apis: {            │                                    │   │
│   │              │    'api': {         │  ◄─── API instance stored          │   │
│   │              │      api: <API>,    │                                    │   │
│   │              │      store: <Store>,│                                    │   │
│   │              │      subscribers:   │                                    │   │
│   │              │        ['mfe-profile']                                   │   │
│   │              │    }                │                                    │   │
│   │              │  }                  │                                    │   │
│   │              └─────────────────────┘                                    │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│                              STEP 2: Second MFE Joins                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │   MFE-Orders calls:                                                     │   │
│   │                                                                         │   │
│   │   createApi({                                                           │   │
│   │     reducerPath: 'api',  ◄─── SAME reducerPath!                         │   │
│   │     tagTypes: ['Order'],  ◄─── May have DIFFERENT tags                   │   │
│   │     baseQuery: fetchBaseQuery({                                         │   │
│   │       baseUrl: '/orders-api'  ◄─── May have DIFFERENT baseUrl           │   │
│   │     }),                                                                 │   │
│   │     endpoints: (builder) => ({                                          │   │
│   │       getOrders: builder.query({...}),                                  │   │
│   │       createOrder: builder.mutation({...})                              │   │
│   │     })                                                                  │   │
│   │   })                                                                    │   │
│   │                                                                         │   │
│   │                         │                                               │   │
│   │                         ▼                                               │   │
│   │              ┌─────────────────────────────────┐                        │   │
│   │              │  1. Detect existing API          │                        │   │
│   │              │  2. Merge new tagTypes ['Order'] │                        │   │
│   │              │  3. Inject endpoints             │                        │   │
│   │              │  4. Route new endpoints to       │                        │   │
│   │              │     MFE-Orders' baseQuery        │                        │   │
│   │              │  5. Subscribe MFE                │                        │   │
│   │              │  6. Warn on config divergence    │                        │   │
│   │              └──────────────┬──────────────────┘                        │   │
│   │                              │                                          │   │
│   │                              ▼                                          │   │
│   │              ┌─────────────────────────────────┐                        │   │
│   │              │  Global Registry                │                        │   │
│   │              │                                 │                        │   │
│   │              │  apis: {                        │                        │   │
│   │              │    'api': {                     │                        │   │
│   │              │      api: <API>,                │  ◄── SAME instance     │   │
│   │              │      store: <Store>,            │                        │   │
│   │              │      baseQueryRouter: <Router>, │  ◄── Routes endpoints  │   │
│   │              │      configSnapshot: {          │                        │   │
│   │              │        tagTypes: ['User','Order']│  ◄── Merged tags      │   │
│   │              │      },                         │                        │   │
│   │              │      subscribers:               │                        │   │
│   │              │        ['mfe-profile',           │                        │   │
│   │              │         'mfe-orders']            │  ◄── Tracked          │   │
│   │              │    }                            │                        │   │
│   │              │  }                              │                        │   │
│   │              └─────────────────────────────────┘                        │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│                              RESULT: Unified API & Cache                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │              ┌─────────────────────────────────────────┐                │   │
│   │              │           SINGLE API INSTANCE           │                │   │
│   │              │                                         │                │   │
│   │              │  Endpoints:                             │                │   │
│   │              │    • getUser      (from mfe-profile)    │                │   │
│   │              │    • updateUser   (from mfe-profile)    │                │   │
│   │              │    • getOrders    (from mfe-orders)     │                │   │
│   │              │    • createOrder  (from mfe-orders)     │                │   │
│   │              │                                         │                │   │
│   │              │  Cache:                                 │                │   │
│   │              │    • getUser(1)     → { name: "John" }  │                │   │
│   │              │    • getOrders("u1") → [...orders]      │                │   │
│   │              │                                         │                │   │
│   │              └─────────────────────────────────────────┘                │   │
│   │                                                                         │   │
│   │   ✅ Both MFEs access same cache                                        │   │
│   │   ✅ User loaded by MFE-Profile is instantly available to MFE-Orders    │   │
│   │   ✅ No duplicate data in memory                                        │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Unified Invalidation

When one MFE updates data, ALL MFEs automatically receive fresh data.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           UNIFIED CACHE INVALIDATION                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                     │
│   │MFE-Profile  │      │MFE-Orders   │      │MFE-Admin    │                     │
│   │             │      │             │      │             │                     │
│   │ UserProfile │      │ OrderList   │      │ UserTable   │                     │
│   │ Component   │      │ Component   │      │ Component   │                     │
│   │             │      │             │      │             │                     │
│   │ Subscribed  │      │ Subscribed  │      │ Subscribed  │                     │
│   │ to User #1  │      │ to User #1  │      │ to Users    │                     │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘                     │
│          │                    │                    │                            │
│          │ ┌──────────────────┴────────────────────┴──────────────┐             │
│          │ │                                                      │             │
│          │ │                   SHARED CACHE                       │             │
│          │ │  ┌───────────────────────────────────────────────┐   │             │
│          │ │  │ getUser(1) → { id: 1, name: "John" }          │   │             │
│          │ │  │ getUsers() → [{ id: 1, name: "John" }, ...]   │   │             │
│          │ │  │                                               │   │             │
│          │ │  │ Tags: [{ type: 'User', id: 1 },               │   │             │
│          │ │  │        { type: 'User', id: 'LIST' }]          │   │             │
│          │ │  └───────────────────────────────────────────────┘   │             │
│          │ │                                                      │             │
│          │ └──────────────────────────────────────────────────────┘             │
│          │                                                                      │
│          │                                                                      │
│   ═══════╪════════════════════ MUTATION OCCURS ════════════════════════════     │
│          │                                                                      │
│          ▼                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │  MFE-Profile triggers mutation:                                         │   │
│   │                                                                         │   │
│   │  updateUser({                                                           │   │
│   │    id: 1,                                                               │   │
│   │    name: "John Smith"   ◄─── Name changed!                              │   │
│   │  })                                                                     │   │
│   │                                                                         │   │
│   │  Endpoint definition:                                                   │   │
│   │  invalidatesTags: [                                                     │   │
│   │    { type: 'User', id: 1 },                                             │   │
│   │    { type: 'User', id: 'LIST' }                                         │   │
│   │  ]                                                                      │   │
│   │                                                                         │   │
│   └────────────────────────────────┬────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         RTK QUERY INVALIDATION                          │   │
│   │                                                                         │   │
│   │  1. Remove cache entries matching invalidated tags                      │   │
│   │  2. Notify all subscribers of stale data                                │   │
│   │  3. Trigger automatic refetch for active subscriptions                  │   │
│   │                                                                         │   │
│   └────────────────────────────────┬────────────────────────────────────────┘   │
│                                    │                                            │
│             ┌──────────────────────┼───────────────────────┐                    │
│             │                      │                       │                    │
│             ▼                      ▼                       ▼                    │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│   │  MFE-Profile    │    │  MFE-Orders     │    │  MFE-Admin      │            │
│   │                 │    │                 │    │                 │            │
│   │  🔄 Refetches   │    │  🔄 Refetches   │    │  🔄 Refetches   │            │
│   │  getUser(1)     │    │  getUser(1)     │    │  getUsers()     │            │
│   │                 │    │                 │    │                 │            │
│   │  Shows:         │    │  Shows:         │    │  Shows:         │            │
│   │  "John Smith"   │    │  "John Smith"   │    │  "John Smith"   │            │
│   │                 │    │                 │    │  in user list   │            │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                              RESULT                                     │   │
│   │                                                                         │   │
│   │    ✅ ONE mutation in MFE-Profile                                       │   │
│   │    ✅ ALL THREE MFEs automatically updated                              │   │
│   │    ✅ No manual synchronization needed                                  │   │
│   │    ✅ Data consistency guaranteed                                       │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Reference Counting

Prevents cache eviction while ANY MFE is still using the data.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          REFERENCE COUNTING SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Timeline ────────────────────────────────────────────────────────────────►    │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  T=0: MFE-Profile loads User #1                                         │   │
│   │                                                                         │   │
│   │  refCountManager.increment('getUser({"id":1})', 'mfe-profile')          │   │
│   │                                                                         │   │
│   │  Cache Key: getUser({"id":1})                                           │   │
│   │  ┌──────────────────────────────────────────────────────────┐           │   │
│   │  │  count: 1                                                │           │   │
│   │  │  subscribers: ['mfe-profile']                            │           │   │
│   │  └──────────────────────────────────────────────────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  T=100ms: MFE-Orders loads same User #1                                 │   │
│   │                                                                         │   │
│   │  refCountManager.increment('getUser({"id":1})', 'mfe-orders')           │   │
│   │                                                                         │   │
│   │  Cache Key: getUser({"id":1})                                           │   │
│   │  ┌──────────────────────────────────────────────────────────┐           │   │
│   │  │  count: 2   ◄─── Incremented                             │           │   │
│   │  │  subscribers: ['mfe-profile', 'mfe-orders']              │           │   │
│   │  └──────────────────────────────────────────────────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  T=200ms: MFE-Admin loads same User #1                                  │   │
│   │                                                                         │   │
│   │  refCountManager.increment('getUser({"id":1})', 'mfe-admin')            │   │
│   │                                                                         │   │
│   │  Cache Key: getUser({"id":1})                                           │   │
│   │  ┌──────────────────────────────────────────────────────────┐           │   │
│   │  │  count: 3   ◄─── Incremented                             │           │   │
│   │  │  subscribers: ['mfe-profile', 'mfe-orders', 'mfe-admin'] │           │   │
│   │  └──────────────────────────────────────────────────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  T=5000ms: MFE-Profile UNMOUNTS (user navigates away)                   │   │
│   │                                                                         │   │
│   │  ⚠️ Without ref counting: Cache might be evicted!                       │   │
│   │                                                                         │   │
│   │  ✅ With ref counting:                                                  │   │
│   │  refCountManager.decrement('getUser({"id":1})', 'mfe-profile')          │   │
│   │                                                                         │   │
│   │  Cache Key: getUser({"id":1})                                           │   │
│   │  ┌──────────────────────────────────────────────────────────┐           │   │
│   │  │  count: 2   ◄─── Decremented (still > 0!)                │           │   │
│   │  │  subscribers: ['mfe-orders', 'mfe-admin']                │           │   │
│   │  │                                                          │           │   │
│   │  │  🔒 CACHE RETAINED - Other MFEs still using it           │           │   │
│   │  └──────────────────────────────────────────────────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  T=10000ms: MFE-Orders UNMOUNTS                                         │   │
│   │                                                                         │   │
│   │  refCountManager.decrement('getUser({"id":1})', 'mfe-orders')           │   │
│   │                                                                         │   │
│   │  Cache Key: getUser({"id":1})                                           │   │
│   │  ┌──────────────────────────────────────────────────────────┐           │   │
│   │  │  count: 1   ◄─── Decremented (still > 0!)                │           │   │
│   │  │  subscribers: ['mfe-admin']                              │           │   │
│   │  │                                                          │           │   │
│   │  │  🔒 CACHE RETAINED - MFE-Admin still using it            │           │   │
│   │  └──────────────────────────────────────────────────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  T=15000ms: MFE-Admin UNMOUNTS (last subscriber)                        │   │
│   │                                                                         │   │
│   │  refCountManager.decrement('getUser({"id":1})', 'mfe-admin')            │   │
│   │                                                                         │   │
│   │  Cache Key: getUser({"id":1})                                           │   │
│   │  ┌──────────────────────────────────────────────────────────┐           │   │
│   │  │  count: 0   ◄─── Now zero!                               │           │   │
│   │  │  subscribers: []                                         │           │   │
│   │  │                                                          │           │   │
│   │  │  🗑️ CACHE CAN BE EVICTED - No one using it anymore       │           │   │
│   │  │     (subject to keepUnusedDataFor timer)                 │           │   │
│   │  └──────────────────────────────────────────────────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. URL-Based Auto-Invalidation

Automatically invalidates queries based on mutation URL patterns, **eliminating the need for cross-MFE tag coordination**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        URL-BASED AUTO-INVALIDATION FLOW                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         AUTOMATIC REST CONVENTIONS                       │   │
│   │                                                                         │   │
│   │   Mutation                              Automatically Invalidates        │   │
│   │   ─────────────────────────────────────────────────────────────────     │   │
│   │   POST   /users          ─────────►   GET /users (list queries)        │   │
│   │   PUT    /users/123      ─────────►   GET /users + GET /users/123      │   │
│   │   PATCH  /users/123      ─────────►   GET /users + GET /users/123      │   │
│   │   DELETE /users/123      ─────────►   GET /users + GET /users/123      │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                              EXAMPLE FLOW                                │   │
│   │                                                                         │   │
│   │   1. MFE-Profile fetches:  GET /users/123                               │   │
│   │      └── Registered in URL Invalidation Manager                         │   │
│   │                                                                         │   │
│   │   2. MFE-Orders fetches:   GET /users                                   │   │
│   │      └── Registered in URL Invalidation Manager                         │   │
│   │                                                                         │   │
│   │   3. MFE-Admin mutates:    DELETE /users/123                            │   │
│   │      │                                                                  │   │
│   │      ▼                                                                  │   │
│   │   ┌──────────────────────────────────────────────────────────────┐      │   │
│   │   │ URL Invalidation Manager                                     │      │   │
│   │   │                                                              │      │   │
│   │   │ Mutation: DELETE /users/123                                  │      │   │
│   │   │ Base path: /users                                            │      │   │
│   │   │ Has ID: Yes (123)                                            │      │   │
│   │   │                                                              │      │   │
│   │   │ Matches:                                                     │      │   │
│   │   │   ✓ GET /users     (same base path, list query)             │      │   │
│   │   │   ✓ GET /users/123 (same resource)                          │      │   │
│   │   └──────────────────────────────────────────────────────────────┘      │   │
│   │      │                                                                  │   │
│   │      ▼                                                                  │   │
│   │   4. Both queries automatically invalidated & refetched                 │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        CROSS-RESOURCE INVALIDATION                       │   │
│   │                                                                         │   │
│   │   For non-standard relationships (e.g., user changes affect orders):    │   │
│   │                                                                         │   │
│   │   import { urlInvalidationManager } from 'federated-query';             │   │
│   │                                                                         │   │
│   │   // When any user is modified, also invalidate orders                  │   │
│   │   urlInvalidationManager.invalidateOn(                                  │   │
│   │     '/users/*',           // Source pattern                             │   │
│   │     ['/orders', '/orders/*']  // Target patterns to invalidate          │   │
│   │   );                                                                    │   │
│   │                                                                         │   │
│   │   // Only on DELETE, invalidate related data                            │   │
│   │   urlInvalidationManager.invalidateOn(                                  │   │
│   │     '/users/*',                                                         │   │
│   │     ['/dashboard/stats'],                                               │   │
│   │     ['DELETE']            // Only for DELETE method                     │   │
│   │   );                                                                    │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                           PATTERN SYNTAX                                 │   │
│   │                                                                         │   │
│   │   Pattern          Matches                                              │   │
│   │   ────────────────────────────────────────────────────────────────      │   │
│   │   /users/*         /users/123, /users/abc                               │   │
│   │   /users/**        /users/123, /users/123/orders, /users/123/orders/1   │   │
│   │   /api/*/items     /api/v1/items, /api/v2/items                         │   │
│   │                                                                         │   │
│   │   ID Detection (automatic):                                             │   │
│   │   • Numeric:    /users/123                                              │   │
│   │   • UUID:       /users/550e8400-e29b-41d4-a716-446655440000             │   │
│   │   • MongoDB:    /users/507f1f77bcf86cd799439011                         │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                              BENEFITS                                    │   │
│   │                                                                         │   │
│   │   ✅ Zero tag coordination - no need to match tags across MFEs          │   │
│   │   ✅ Works automatically for standard REST APIs                         │   │
│   │   ✅ Configurable for complex relationships                             │   │
│   │   ✅ Supports wildcard patterns (* and **)                              │   │
│   │   ✅ Method-specific rules (POST, PUT, PATCH, DELETE)                   │   │
│   │   ✅ Window-level singleton — survives Module Federation bundle splits  │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Configuration Example

```typescript
// app-init.ts - Configure once at app startup
import { urlInvalidationManager } from 'federated-query';

// Cross-resource invalidations
urlInvalidationManager.invalidateOn('/users/*', ['/orders', '/orders/*']);
urlInvalidationManager.invalidateOn('/products/*', ['/inventory', '/pricing/*']);

// Enable debug logging
urlInvalidationManager.setDebug(true);
```

---

### 6. Config Merging & Base Query Routing

When multiple MFEs call `createApi()` with the same `reducerPath`, the library now **detects, merges, and routes** rather than silently discarding the second MFE's config.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     CONFIG MERGING & BASE QUERY ROUTING                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    WHAT HAPPENS ON SECOND REGISTRATION                   │   │
│   │                                                                         │   │
│   │   MFE-A (first):                        MFE-B (second):                 │   │
│   │   ┌─────────────────────┐               ┌─────────────────────┐        │   │
│   │   │ reducerPath: 'api'  │               │ reducerPath: 'api'  │        │   │
│   │   │ baseUrl: /users-api │               │ baseUrl: /orders-api│        │   │
│   │   │ tagTypes: ['User']  │               │ tagTypes: ['Order'] │        │   │
│   │   │ keepUnusedDataFor:  │               │ keepUnusedDataFor:  │        │   │
│   │   │   300               │               │   600               │        │   │
│   │   │ endpoints:          │               │ endpoints:          │        │   │
│   │   │   getUser           │               │   getOrders         │        │   │
│   │   │   updateUser        │               │   createOrder       │        │   │
│   │   └─────────────────────┘               └──────────┬──────────┘        │   │
│   │                                                     │                   │   │
│   │                                                     ▼                   │   │
│   │                                          ┌──────────────────────┐       │   │
│   │                                          │  createApi detects   │       │   │
│   │                                          │  existing 'api'      │       │   │
│   │                                          └──────────┬───────────┘       │   │
│   │                                                     │                   │   │
│   │                            ┌────────────────────────┼─────────────┐     │   │
│   │                            │                        │             │     │   │
│   │                            ▼                        ▼             ▼     │   │
│   │                   ┌────────────────┐  ┌──────────────────┐ ┌─────────┐ │   │
│   │                   │ MERGE tagTypes │  │ ROUTE baseQuery  │ │  WARN   │ │   │
│   │                   │                │  │                  │ │ on diff │ │   │
│   │                   │ ['User'] +     │  │ getUser    → /A  │ │ config  │ │   │
│   │                   │ ['Order'] =    │  │ updateUser → /A  │ │         │ │   │
│   │                   │ ['User',       │  │ getOrders  → /B  │ │ keepUnu │ │   │
│   │                   │  'Order']      │  │ createOrder→ /B  │ │ sedData │ │   │
│   │                   └────────────────┘  └──────────────────┘ └─────────┘ │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        BASE QUERY ROUTER FLOW                           │   │
│   │                                                                         │   │
│   │   When any endpoint is called, the router dispatches to the correct     │   │
│   │   backend based on which MFE defined that endpoint:                     │   │
│   │                                                                         │   │
│   │   Component calls useGetUserQuery(1)                                    │   │
│   │          │                                                              │   │
│   │          ▼                                                              │   │
│   │   ┌────────────────────────────────────────────────┐                    │   │
│   │   │              Base Query Router                 │                    │   │
│   │   │                                                │                    │   │
│   │   │   endpoint: "getUser"                          │                    │   │
│   │   │     → lookup in endpointMap                    │                    │   │
│   │   │     → found: MFE-A's enhanced baseQuery        │                    │   │
│   │   │     → dispatch to /users-api                   │                    │   │
│   │   └───────────────────────┬────────────────────────┘                    │   │
│   │                           │                                             │   │
│   │                           ▼                                             │   │
│   │                  GET /users-api/users/1                                  │   │
│   │                                                                         │   │
│   │                                                                         │   │
│   │   Component calls useGetOrdersQuery()                                   │   │
│   │          │                                                              │   │
│   │          ▼                                                              │   │
│   │   ┌────────────────────────────────────────────────┐                    │   │
│   │   │              Base Query Router                 │                    │   │
│   │   │                                                │                    │   │
│   │   │   endpoint: "getOrders"                        │                    │   │
│   │   │     → lookup in endpointMap                    │                    │   │
│   │   │     → found: MFE-B's enhanced baseQuery        │                    │   │
│   │   │     → dispatch to /orders-api                  │                    │   │
│   │   └───────────────────────┬────────────────────────┘                    │   │
│   │                           │                                             │   │
│   │                           ▼                                             │   │
│   │                  GET /orders-api/orders                                  │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                   INVALIDATION IS INDEPENDENT OF ROUTING                │   │
│   │                                                                         │   │
│   │   Invalidation (tag or URL-based) decides WHAT to refetch.              │   │
│   │   The router decides WHERE each refetch goes.                           │   │
│   │   These are orthogonal — they don't interfere.                          │   │
│   │                                                                         │   │
│   │   1. Mutation completes (e.g. POST /orders-api/orders)                  │   │
│   │   2. Invalidation says: refetch getOrders  ◄── decides WHAT             │   │
│   │   3. RTK Query calls baseQuery for getOrders                            │   │
│   │   4. Router dispatches to /orders-api      ◄── decides WHERE            │   │
│   │                                                                         │   │
│   │   URL-based invalidation uses relative paths (/orders, /users),         │   │
│   │   so /users mutations only invalidate /users queries — never            │   │
│   │   /orders queries, even though they share a reducerPath.                │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     MERGE vs ROUTE vs WARN SUMMARY                      │   │
│   │                                                                         │   │
│   │   Config                    Behavior                                    │   │
│   │   ────────────────────────────────────────────────────────────────      │   │
│   │   tagTypes                  MERGED — union of both MFEs' tags           │   │
│   │   baseQuery                 ROUTED — each MFE's endpoints use           │   │
│   │                             their own enhanced baseQuery                │   │
│   │   mfeOptions                PER-MFE — applied to each MFE's own        │   │
│   │                             enhanced baseQuery via the router           │   │
│   │   keepUnusedDataFor         WARN — first value wins, logs warning       │   │
│   │                             (only remaining first-registerer-wins)      │   │
│   │   MFE subscription          TRACKED — subscribe() called automatically  │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### How It Works

```typescript
// First MFE registers — creates the API with a base query router
const router = createBaseQueryRouter(enhancedBaseQuery);
const api = rtkCreateApi({ baseQuery: router.baseQuery, ... });
registerApi(reducerPath, api, store, mfeName, configSnapshot, router);

// Second MFE registers — injects endpoints and adds routes
const existingApi = getRegisteredApi(reducerPath);
const router = getRegisteredRouter(reducerPath);

// Merge tagTypes
existingApi.enhanceEndpoints({ addTagTypes: newTags });

// Snapshot endpoints, inject, diff
const before = new Set(Object.keys(existingApi.endpoints));
const enhanced = existingApi.injectEndpoints({ endpoints, overrideExisting: false });
const newEndpoints = Object.keys(enhanced.endpoints).filter(n => !before.has(n));

// Route new endpoints to this MFE's own baseQuery
const enhancedIncomingBaseQuery = enhanceBaseQuery(baseQuery, { ...mfeOptions });
router.addRoutes(newEndpoints, enhancedIncomingBaseQuery);
```

---

## API Reference

### Exports

#### Main Exports (`federated-query`)

```typescript
import {
  // Core API functions (drop-in replacements)
  createApi,
  fetchBaseQuery,

  // Original RTK Query (for advanced cases)
  originalCreateApi,
  originalFetchBaseQuery,

  // Registry utilities
  getGlobalRegistry,
  getRegistryStats,
  resetRegistry,
  isApiRegistered,
  getRegisteredApi,
  getRegisteredConfig,       // Config snapshot for a registered API
  getRegisteredRouter,       // Base query router for a registered API
  updateConfigSnapshot,      // Update config snapshot after merging

  // Base Query Router
  createBaseQueryRouter,     // Create a routing baseQuery wrapper

  // MFE Context
  getMfeContext,
  setMfeContext,
  clearMfeContext,
  detectMfeName,
  isInMfeEnvironment,

  // Managers (singletons — window-level to survive across MFE bundles)
  refCountManager,
  requestTracker,
  urlInvalidationManager,  // URL-based auto-invalidation (window.__DTSL_URL_INVALIDATION_MANAGER__)

  // Middleware (for custom store setup)
  createCacheLifecycleMiddleware,
  createUrlInvalidationMiddleware,
} from 'federated-query';

// Type exports
import type {
  ApiConfigSnapshot,         // Config captured at registration time
  BaseQueryRouter,           // Router interface with addRoutes()
  UrlPattern,
  InvalidationRule,
  UrlInvalidationOptions,
  CrossResourceInvalidation,
} from 'federated-query';
```

#### React Exports (`federated-query/react`)

```typescript
import {
  // Provider component
  Provider,

  // Core API functions
  createApi,
  fetchBaseQuery,

  // RTK Query utilities
  setupListeners,
  QueryStatus,
  skipToken,
  retry,

  // Managers (singletons)
  urlInvalidationManager,

  // Registry & Routing
  getRegisteredConfig,
  getRegisteredRouter,
  updateConfigSnapshot,
  createBaseQueryRouter,

  // Middleware
  createCacheLifecycleMiddleware,
  createUrlInvalidationMiddleware,
} from 'federated-query/react';
```

### createApi Options

```typescript
createApi({
  // Standard RTK Query options
  reducerPath: 'api',          // 🔑 Use same across MFEs for sharing
  baseQuery: fetchBaseQuery({...}),
  tagTypes: ['User', 'Order'],
  endpoints: (builder) => ({...}),

  // MFE-specific options
  mfeOptions: {
    standalone: false,           // Set true to disable MFE features
    enableCoalescing: true,      // Enable request coalescing
    enableTracking: true,        // Enable request tracking
    enableUrlInvalidation: true, // Enable URL-based auto-invalidation
    addMfeHeader: true,          // Add X-MFE-Source header to requests
    mfeHeaderName: 'X-MFE-Source', // Custom header name
  }
})
```

### Provider Props

```typescript
<Provider
  store={store}               // Redux store instance
  mfeName="mfe-profile"       // Optional: explicit MFE name
  standalone={false}          // Optional: run without MFE features
>
  {children}
</Provider>
```

---

## Debugging & Observability

### Get Registry Statistics

```typescript
import { getRegistryStats } from 'federated-query/react';

const stats = getRegistryStats();

console.log(stats);
// {
//   apiCount: 1,
//   storeCount: 1,
//   apis: {
//     'api': {
//       subscribers: ['mfe-profile', 'mfe-orders', 'mfe-admin'],
//       subscriberCount: 3,
//       createdBy: 'mfe-profile',
//       createdAt: 1707123456789
//     }
//   },
//   requestStats: {
//     activeRequests: 0,
//     totalRequests: 25,
//     totalCoalesced: 8,    // 8 requests saved!
//     byEndpoint: { '/users': 15, '/orders': 10 },
//     byMfe: { 'mfe-profile': 10, 'mfe-orders': 8, 'mfe-admin': 7 }
//   },
//   refCountStats: {
//     totalCacheKeys: 5,
//     totalSubscriptions: 8,
//     byMfe: { 'mfe-profile': 3, 'mfe-orders': 4, 'mfe-admin': 1 }
//   }
// }
```

### Console Debug Headers

All requests include an `X-MFE-Source` header for debugging:

```
GET /api/users/1
X-MFE-Source: mfe-profile
```

---

## Best Practices

### ✅ DO: Use Same reducerPath

```typescript
// mfe-profile/api.ts
export const api = createApi({
  reducerPath: 'api',  // ✅ Same name
  // ...
});

// mfe-orders/api.ts
export const api = createApi({
  reducerPath: 'api',  // ✅ Same name = shared cache
  // ...
});
```

### ✅ DO: Share reducerPath Even With Different baseUrls

```typescript
// mfe-profile/api.ts — points at users service
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/users-api' }),  // ✅ Different baseUrl is OK!
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUser: builder.query({ query: (id) => `/users/${id}` }),
  }),
});

// mfe-orders/api.ts — points at orders service
export const api = createApi({
  reducerPath: 'api',  // ✅ Same reducerPath = shared cache + automatic routing
  baseQuery: fetchBaseQuery({ baseUrl: '/orders-api' }),
  tagTypes: ['Order'],
  endpoints: (builder) => ({
    getOrders: builder.query({ query: () => `/orders` }),
  }),
});
// getUser → /users-api, getOrders → /orders-api — routed automatically!
```

### ❌ DON'T: Use Different reducerPaths (Unless Intentional)

```typescript
// mfe-profile/api.ts
export const api = createApi({
  reducerPath: 'profileApi',  // ❌ Different name = separate caches
  // ...
});

// mfe-orders/api.ts
export const api = createApi({
  reducerPath: 'ordersApi',   // ❌ No shared cache, no cross-MFE invalidation
  // ...
});
// Only use different reducerPaths if you explicitly DON'T want cache sharing.
```

### ✅ DO: Use Consistent Tags (Optional with URL Invalidation)

```typescript
// With URL-based auto-invalidation, tags are OPTIONAL
// But you can still use them for complex scenarios:
tagTypes: ['User', 'Order', 'Product']

// Use consistent tag shapes
providesTags: (result, error, id) => [{ type: 'User', id }]
invalidatesTags: [{ type: 'User', id: 'LIST' }]
```

### ✅ DO: Configure Cross-Resource Invalidation Once

```typescript
// app-init.ts or store setup - configure ONCE at startup
import { urlInvalidationManager } from 'federated-query';

// User changes affect orders (e.g., user name shown in orders)
urlInvalidationManager.invalidateOn('/users/*', ['/orders', '/orders/*']);

// Product deletion affects inventory
urlInvalidationManager.invalidateOn('/products/*', ['/inventory/*'], ['DELETE']);
```

### ✅ DO: Provide Explicit MFE Name

```tsx
// Explicit is better than implicit
<Provider store={store} mfeName="mfe-profile">
```

---

## Performance

| Metric | Without federated-query | With federated-query |
|--------|------------------------|---------------------|
| Duplicate Requests | 3 per endpoint | 1 (coalesced) |
| Network Bandwidth | 100% | ~33% (67% saved) |
| Cache Memory | 3x (per MFE) | 1x (shared) |
| Invalidation Sync | Manual | Automatic |
| Store Instances | Multiple | Single |

---

## License

MIT

---

<p align="center">
  Built with ❤️ for Micro-Frontend architectures
</p>
