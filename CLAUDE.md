# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turborepo monorepo demonstrating Micro-Frontend (MFE) architecture with Module Federation and shared state management using RTK Query.

**Tech Stack:** React 18, TypeScript 5.4, Vite 5.4, Redux Toolkit 2.2, TailwindCSS 3.4, Turbo 2.3

## Commands

```bash
# Development - starts all apps and mock API (15 concurrent processes)
yarn dev

# Build all packages/apps
yarn build

# Lint all projects
yarn lint

# Format code
yarn format

# Full cleanup
yarn clean
```

**Per-app standalone mode** (run MFE in isolation without federation):
```bash
cd apps/mfe-profile && yarn dev:standalone
```

## Architecture

### Monorepo Structure

```
apps/
  host/          # Shell app (port 3000) - orchestrates MFEs via Module Federation
  mfe-admin/     # Admin MFE (port 3004)
  mfe-profile/   # Profile MFE (port 3002)
  mfe-orders/    # Orders MFE (port 3003)
  remote-app/    # Demo app (port 3001)
  mock-api/      # Express REST API (port 4000)

packages/
  mfe-data-layer/   # @org/mfe-data-layer - RTK Query wrapper for MFEs (core library)
  shared-api/       # @repo/shared-api - API layer wrapper
  ui/               # @repo/ui - Shared React components
  utils/            # @repo/utils - Utility functions
  tsconfig/         # @repo/tsconfig - Shared TS configs
```

### Module Federation Flow

Host app consumes remote MFEs via `@originjs/vite-plugin-federation`:
- Remotes expose components via `remoteEntry.js` files
- Shared dependencies (react, react-dom, react-redux, @reduxjs/toolkit) are deduplicated
- MFEs can run standalone for development or as federated remotes

### @org/mfe-data-layer (Core Library)

The central innovation enabling MFE state sharing:

- **Request Coalescing:** Multiple MFEs requesting same data = 1 API call
- **Shared Cache:** Data loaded by one MFE immediately available to others
- **Unified Invalidation:** Mutation in one MFE updates views across all MFEs
- **Race Condition Handling:** Reference counting and mutex protection
- **API Versioning:** v1/v2 endpoints with cache segregation

Key exports: `createSharedApi`, `SharedStoreProvider`, `useSharedSelector`, `useSharedDispatch`

## Development Notes

- **Port allocation:** 3000 (host), 3001 (remote-app), 3002 (profile), 3003 (orders), 3004 (admin), 4000 (mock-api)
- **Start order:** Mock API starts automatically with `yarn dev`; all ports must be available
- **Path alias:** All apps use `@/*` → `./src/*`
- **TypeScript:** Strict mode enabled; extends `@repo/tsconfig/vite.json`
- **Build outputs:** `dist/` directories (cached by Turbo)
