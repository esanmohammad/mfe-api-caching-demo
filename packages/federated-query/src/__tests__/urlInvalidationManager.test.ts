import { describe, it, expect } from 'vitest';
import { UrlInvalidationManager } from '../invalidation/urlInvalidationManager';

const RP = 'api';

function managerWithQueries(
  queries: Array<[endpoint: string, url: string]>,
): UrlInvalidationManager {
  const m = new UrlInvalidationManager();
  for (const [endpoint, url] of queries) {
    m.registerQuery(endpoint, url, 'GET', RP);
  }
  return m;
}

describe('UrlInvalidationManager — REST auto-invalidation', () => {
  it('POST /users invalidates the list query, not item queries', () => {
    const m = managerWithQueries([
      ['getUsers', '/users'],
      ['getUser', '/users/1'],
    ]);
    const result = m.findQueriesToInvalidate('/users', 'POST', RP);
    expect(result).toContain('getUsers');
    expect(result).not.toContain('getUser');
  });

  it('DELETE /users/1 invalidates both the list and the matching item', () => {
    const m = managerWithQueries([
      ['getUsers', '/users'],
      ['getUser', '/users/1'],
      ['getOther', '/users/2'],
    ]);
    const result = m.findQueriesToInvalidate('/users/1', 'DELETE', RP);
    expect(result).toContain('getUsers');
    expect(result).toContain('getUser');
    // The non-matching item id should not be invalidated.
    expect(result).not.toContain('getOther');
  });

  it('PATCH /users/1 invalidates the list and the matching item', () => {
    const m = managerWithQueries([
      ['getUsers', '/users'],
      ['getUser', '/users/1'],
    ]);
    const result = m.findQueriesToInvalidate('/users/1', 'PATCH', RP);
    expect(result).toEqual(expect.arrayContaining(['getUsers', 'getUser']));
  });

  it('does not invalidate unrelated resources', () => {
    const m = managerWithQueries([
      ['getOrders', '/orders'],
      ['getUsers', '/users'],
    ]);
    const result = m.findQueriesToInvalidate('/users/1', 'PATCH', RP);
    expect(result).not.toContain('getOrders');
  });

  it('scopes invalidation to the same reducerPath', () => {
    const m = new UrlInvalidationManager();
    m.registerQuery('getUsers', '/users', 'GET', 'apiA');
    m.registerQuery('getUsersB', '/users', 'GET', 'apiB');
    const result = m.findQueriesToInvalidate('/users', 'POST', 'apiA');
    expect(result).toContain('getUsers');
    expect(result).not.toContain('getUsersB');
  });
});

describe('UrlInvalidationManager — cross-resource', () => {
  it('invalidates targets declared via invalidateOn()', () => {
    const m = managerWithQueries([
      ['getUsers', '/users'],
      ['getOrders', '/orders'],
    ]);
    m.invalidateOn('/users/*', ['/orders', '/orders/*']);
    const result = m.findQueriesToInvalidate('/users/1', 'PATCH', RP);
    expect(result).toContain('getOrders');
  });

  it('respects the optional method filter', () => {
    const m = managerWithQueries([['getOrders', '/orders']]);
    m.invalidateOn('/users/*', ['/orders'], ['DELETE']);

    const onPatch = m.findQueriesToInvalidate('/users/1', 'PATCH', RP);
    expect(onPatch).not.toContain('getOrders');

    const onDelete = m.findQueriesToInvalidate('/users/1', 'DELETE', RP);
    expect(onDelete).toContain('getOrders');
  });

  it('supports ** for deep paths and * for single segments', () => {
    const m = managerWithQueries([
      ['shallow', '/orders/1'],
      ['deep', '/orders/1/items/5'],
    ]);
    m.invalidateOn('/users/*', ['/orders/*']); // single segment only
    const single = m.findQueriesToInvalidate('/users/9', 'PATCH', RP);
    expect(single).toContain('shallow');
    expect(single).not.toContain('deep');

    const m2 = managerWithQueries([
      ['shallow', '/orders/1'],
      ['deep', '/orders/1/items/5'],
    ]);
    m2.invalidateOn('/users/*', ['/orders/**']); // any depth
    const deep = m2.findQueriesToInvalidate('/users/9', 'PATCH', RP);
    expect(deep).toEqual(expect.arrayContaining(['shallow', 'deep']));
  });

  it('detects UUID and ObjectId ids, not just numeric', () => {
    const m = managerWithQueries([
      ['getUsers', '/users'],
      ['getUser', '/users/550e8400-e29b-41d4-a716-446655440000'],
    ]);
    const result = m.findQueriesToInvalidate(
      '/users/550e8400-e29b-41d4-a716-446655440000',
      'DELETE',
      RP,
    );
    expect(result).toEqual(expect.arrayContaining(['getUsers', 'getUser']));
  });
});
