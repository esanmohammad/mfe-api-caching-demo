# MFE API Caching Demo

Turborepo monorepo demonstrating Micro-Frontend (MFE) architecture with Module Federation and shared state management using **@dtsl/rtk-query**.

## What is @dtsl/rtk-query?

A drop-in replacement for Redux Toolkit Query that enables transparent **cache sharing**, **request coalescing**, and **unified invalidation** across independently deployed MFEs — with zero configuration.

```typescript
// Just swap the import — that's it!
- import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
+ import { createApi, fetchBaseQuery } from '@dtsl/rtk-query/react';
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Request Coalescing** | Multiple MFEs requesting same data = 1 API call |
| **Shared Cache** | Data loaded by one MFE is instantly available to others |
| **Unified Invalidation** | Mutation in one MFE updates views across ALL MFEs |
| **Reference Counting** | Prevents premature cache eviction |
| **URL-Based Auto-Invalidation** | Automatic cache invalidation based on REST URL patterns — no tags needed |
| **Base Query Routing** | MFEs with different baseUrls share the same reducerPath — endpoints are routed to the correct backend |
| **Config Merging** | tagTypes from multiple MFEs are automatically merged |

## Tech Stack

React 18, TypeScript 5.4, Vite 5.4, Redux Toolkit 2.2, TailwindCSS 3.4, Turbo 2.3

## Monorepo Structure

```
apps/
  host/                 # Shell app (port 3000)
  mfe-profile/          # Profile MFE (port 3002)
  mfe-orders/           # Orders MFE (port 3003)
  mfe-admin/            # Admin MFE (port 3004)
  mock-api/             # Express REST API (port 4000)
  demo-cross-resource/  # Cross-resource invalidation demo (port 4006)
  demo-tag-based/       # Tag-based invalidation demo (port 4007)
  demo-list-*/          # URL-based auto-invalidation demos

packages/
  dtsl-rtk-query/       # @dtsl/rtk-query — the core library
  shared-api/           # API layer wrapper
  ui/                   # Shared React components
  utils/                # Utility functions
```

## Getting Started

```bash
yarn install

# Start all apps + mock API
yarn dev

# Start demo apps only
yarn demo:dev
# Open http://localhost:4005
```

## Demo Scenarios

| Demo | Port | What It Tests |
|------|------|---------------|
| demo-list-add | 4002 | POST creates item, list auto-refreshes |
| demo-list-update | 4003 | PUT/PATCH updates item, list + detail auto-refresh |
| demo-list-delete | 4001 | DELETE removes item, list auto-refreshes |
| demo-cross-resource | 4006 | Mutating Users also refreshes Orders via `invalidateOn()` |
| demo-tag-based | 4007 | Fine-grained control: Rename User vs Create Order vs Transfer Account |

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — AI coding assistant context
- **[packages/dtsl-rtk-query/AGENTS.md](./packages/dtsl-rtk-query/AGENTS.md)** — Comprehensive library documentation
