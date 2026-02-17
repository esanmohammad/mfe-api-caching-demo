/**
 * Serializer Enhancer
 * Creates enhanced cache key serialization for MFE-aware caching
 */

export interface SerializerOptions {
  /**
   * Original serializer function (optional)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalSerializer?: (args: { endpointName: string; queryArgs: any }) => string;
  /**
   * Include MFE source in cache key (for debugging)
   */
  includeMfeInKey?: boolean;
}

/**
 * Create an enhanced query args serializer
 * This ensures cache keys are consistent across MFEs for proper coalescing
 */
export function createEnhancedSerializer(
  options: SerializerOptions = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (args: { endpointName: string; queryArgs: any }) => string {
  const { originalSerializer, includeMfeInKey = false } = options;

  return ({ endpointName, queryArgs }) => {
    // Use original serializer if provided
    if (originalSerializer) {
      return originalSerializer({ endpointName, queryArgs });
    }

    // Default serialization: stable JSON stringify
    const args = queryArgs as Record<string, unknown> | undefined;

    // Create a stable cache key
    const keyData = includeMfeInKey
      ? { ...args }
      : args;

    // Sort keys for stable serialization
    const sortedKey = keyData
      ? JSON.stringify(keyData, Object.keys(keyData).sort())
      : '{}';

    return `${endpointName}(${sortedKey})`;
  };
}

/**
 * Generate a cache key from endpoint and args
 */
export function generateCacheKey(
  endpointName: string,
  queryArgs: unknown
): string {
  const args = queryArgs as Record<string, unknown> | undefined;

  if (!args || Object.keys(args).length === 0) {
    return `${endpointName}({})`;
  }

  // Sort keys for stable serialization
  const sortedKey = JSON.stringify(args, Object.keys(args).sort());
  return `${endpointName}(${sortedKey})`;
}

/**
 * Parse a cache key back to endpoint and args
 */
export function parseCacheKey(
  cacheKey: string
): { endpointName: string; queryArgs: unknown } | null {
  const match = cacheKey.match(/^(.+)\((.+)\)$/);
  if (!match) {
    return null;
  }

  const [, endpointName, argsJson] = match;
  try {
    return {
      endpointName: endpointName!,
      queryArgs: JSON.parse(argsJson!),
    };
  } catch {
    return null;
  }
}
