import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { createApi } from '../createApi';
import { Provider } from '../Provider';
import { urlInvalidationManager } from '../invalidation/urlInvalidationManager';

// ── Mock transport ──────────────────────────────────────────────────────────
// A fn baseQuery that mimics fetchBaseQuery's `meta.request` so the URL
// invalidation layer (which reads baseQueryMeta.request.url) has something to work
// with, and lets us assert per-request MFE attribution headers.

interface MockArgs {
  url: string;
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: unknown;
}

function result(data: unknown, path: string, method: string) {
  return { data, meta: { request: { url: 'http://localhost' + path, method } } };
}

function headerOf(args: MockArgs): string | null {
  const h = args.headers;
  if (h instanceof Headers) return h.get('X-MFE-Source');
  return (h as Record<string, string> | undefined)?.['X-MFE-Source'] ?? null;
}

const getCalls = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls.filter((c) => ((c[0] as MockArgs).method ?? 'GET') === 'GET');

interface Db {
  users: Array<{ id: number; name: string }>;
  orders: Array<{ id: number }>;
}

function buildWorld() {
  const db: Db = { users: [{ id: 1, name: 'Alice' }], orders: [{ id: 10 }] };

  const mockUsers = vi.fn(async (args: MockArgs) => {
    const method = args.method ?? 'GET';
    if (method === 'GET') return result(db.users, '/api/users', 'GET');
    // PATCH /api/users/:id
    db.users = db.users.map((u) => ({ ...u, name: (args.body as { name: string }).name }));
    return result({ ok: true }, args.url, method);
  });

  const mockOrders = vi.fn(async (_args: MockArgs) => result(db.orders, '/api/orders', 'GET'));

  // MFE "users" registers first and declares the cross-resource rule.
  urlInvalidationManager.invalidateOn('/api/users/*', ['/api/orders', '/api/orders/*']);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersApi: any = createApi({
    reducerPath: 'api',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    baseQuery: mockUsers as any,
    mfeOptions: { mfeName: 'mfe-users' },
    endpoints: (b) => ({
      getUsers: b.query<Db['users'], void>({
        query: () => ({ url: '/api/users', method: 'GET' }),
      }),
      updateUser: b.mutation<unknown, { id: number; name: string }>({
        query: ({ id, name }) => ({ url: `/api/users/${id}`, method: 'PATCH', body: { name } }),
      }),
    }),
  });

  // MFE "orders" injects into the same reducerPath.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersApi: any = createApi({
    reducerPath: 'api',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    baseQuery: mockOrders as any,
    mfeOptions: { mfeName: 'mfe-orders' },
    endpoints: (b) => ({
      getOrders: b.query<Db['orders'], void>({
        query: () => ({ url: '/api/orders', method: 'GET' }),
      }),
    }),
  });

  return { db, mockUsers, mockOrders, usersApi, ordersApi };
}

describe('federated cache sharing across MFEs', () => {
  it('serves the same query to two MFE subtrees with a single request', async () => {
    const { usersApi, mockUsers } = buildWorld();

    function ReadOnlyUsers({ testid }: { testid: string }) {
      const { data } = usersApi.useGetUsersQuery();
      return <span data-testid={testid}>{data ? data[0].name : 'loading'}</span>;
    }

    render(
      <Provider mfeName="host">
        <ReadOnlyUsers testid="a" />
        <ReadOnlyUsers testid="b" />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('a').textContent).toBe('Alice');
      expect(screen.getByTestId('b').textContent).toBe('Alice');
    });

    // Both subtrees share one store/cache → one network call.
    expect(getCalls(mockUsers)).toHaveLength(1);
  });

  it('attributes each request to the owning MFE, not the Provider', async () => {
    const { usersApi, ordersApi, mockUsers, mockOrders } = buildWorld();

    function Users() {
      const { data } = usersApi.useGetUsersQuery();
      return <span data-testid="users">{data ? 'ok' : '...'}</span>;
    }
    function Orders() {
      const { data } = ordersApi.useGetOrdersQuery();
      return <span data-testid="orders">{data ? 'ok' : '...'}</span>;
    }

    render(
      <Provider mfeName="host">
        <Users />
        <Orders />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('users').textContent).toBe('ok');
      expect(screen.getByTestId('orders').textContent).toBe('ok');
    });

    // Owner attribution is deterministic regardless of the Provider's mfeName.
    expect(headerOf(mockUsers.mock.calls[0]![0])).toBe('mfe-users');
    expect(headerOf(mockOrders.mock.calls[0]![0])).toBe('mfe-orders');
  });

  it('a mutation in one MFE refetches a related query in another (cross-resource)', async () => {
    const { usersApi, ordersApi, mockOrders } = buildWorld();

    function Users() {
      const { data } = usersApi.useGetUsersQuery();
      const [update] = usersApi.useUpdateUserMutation();
      return (
        <div>
          <span data-testid="users">{data ? data[0].name : '...'}</span>
          <button onClick={() => update({ id: 1, name: 'Renamed' })}>rename</button>
        </div>
      );
    }
    function Orders() {
      const { data } = ordersApi.useGetOrdersQuery();
      return <span data-testid="orders">{data ? data.length : '...'}</span>;
    }

    render(
      <Provider mfeName="host">
        <Users />
        <Orders />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('orders').textContent).toBe('1'));
    expect(mockOrders).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('rename'));

    // Orders MFE refetches because users declared a cross-resource rule.
    await waitFor(() => expect(mockOrders).toHaveBeenCalledTimes(2));
  });
});

describe('two-context store isolation', () => {
  it("keeps the MFE's own local store working alongside federated hooks", async () => {
    const { usersApi } = buildWorld();

    const counter = createSlice({
      name: 'counter',
      initialState: { value: 42 },
      reducers: {},
    });
    const localStore = configureStore({ reducer: { counter: counter.reducer } });

    function Panel() {
      // default context → the MFE's own local store
      const value = useSelector((s: { counter: { value: number } }) => s.counter.value);
      // federated context → the shared store
      const { data } = usersApi.useGetUsersQuery();
      return (
        <div>
          <span data-testid="local">{value}</span>
          <span data-testid="api">{data ? 'ok' : '...'}</span>
        </div>
      );
    }

    render(
      <Provider store={localStore} mfeName="mfe-x">
        <Panel />
      </Provider>,
    );

    // Local state is intact (not clobbered by the library taking over the store).
    expect(screen.getByTestId('local').textContent).toBe('42');
    // And the federated API hook works against the shared store.
    await waitFor(() => expect(screen.getByTestId('api').textContent).toBe('ok'));
  });
});

describe('endpoint name collisions', () => {
  it('warns instead of silently dropping a duplicate endpoint', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mock = vi.fn(async () => result([], '/api/users', 'GET'));

    createApi({
      reducerPath: 'api',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseQuery: mock as any,
      mfeOptions: { mfeName: 'a' },
      endpoints: (b) => ({
        getUsers: b.query<unknown, void>({ query: () => ({ url: '/api/users', method: 'GET' }) }),
      }),
    });

    createApi({
      reducerPath: 'api',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseQuery: mock as any,
      mfeOptions: { mfeName: 'b' },
      endpoints: (b) => ({
        getUsers: b.query<unknown, void>({ query: () => ({ url: '/api/users', method: 'GET' }) }),
      }),
    });

    const warnedAboutGetUsers = warn.mock.calls.some((c) =>
      c.map(String).join(' ').includes('getUsers'),
    );
    expect(warnedAboutGetUsers).toBe(true);

    warn.mockRestore();
  });
});
