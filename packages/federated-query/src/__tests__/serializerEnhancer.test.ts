import { describe, it, expect } from 'vitest';
import {
  generateCacheKey,
  parseCacheKey,
  createEnhancedSerializer,
} from '../enhancers/serializerEnhancer';

describe('serializerEnhancer', () => {
  it('produces a stable key regardless of arg key order', () => {
    const a = generateCacheKey('getThing', { b: 2, a: 1 });
    const b = generateCacheKey('getThing', { a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('handles empty / undefined args', () => {
    expect(generateCacheKey('getThing', undefined)).toBe('getThing({})');
    expect(generateCacheKey('getThing', {})).toBe('getThing({})');
  });

  it('round-trips through parseCacheKey', () => {
    const key = generateCacheKey('getThing', { id: 7 });
    const parsed = parseCacheKey(key);
    expect(parsed).toEqual({ endpointName: 'getThing', queryArgs: { id: 7 } });
  });

  it('createEnhancedSerializer is stable across key order', () => {
    const serialize = createEnhancedSerializer();
    const a = serialize({ endpointName: 'e', queryArgs: { x: 1, y: 2 } });
    const b = serialize({ endpointName: 'e', queryArgs: { y: 2, x: 1 } });
    expect(a).toBe(b);
  });

  it('defers to a provided original serializer', () => {
    const serialize = createEnhancedSerializer({
      originalSerializer: ({ endpointName }) => `custom:${endpointName}`,
    });
    expect(serialize({ endpointName: 'e', queryArgs: { x: 1 } })).toBe('custom:e');
  });
});
