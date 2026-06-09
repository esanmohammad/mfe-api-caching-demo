/**
 * Reference Count Manager
 * Tracks which MFEs are subscribed to which cache entries
 * Prevents premature cache garbage collection when multiple MFEs share data
 */

export interface RefCountState {
  counts: Map<string, number>;
  subscribers: Map<string, Set<string>>;
}

export interface RefCountStats {
  totalCacheKeys: number;
  totalSubscriptions: number;
  byMfe: Record<string, number>;
  byCacheKey: Record<string, { count: number; subscribers: string[] }>;
}

class RefCountManagerImpl {
  private state: RefCountState = {
    counts: new Map(),
    subscribers: new Map(),
  };

  /**
   * Increment reference count for a cache key from an MFE
   */
  increment(cacheKey: string, mfeName: string): number {
    // Update count
    const newCount = (this.state.counts.get(cacheKey) ?? 0) + 1;
    this.state.counts.set(cacheKey, newCount);

    // Track subscriber
    if (!this.state.subscribers.has(cacheKey)) {
      this.state.subscribers.set(cacheKey, new Set());
    }
    this.state.subscribers.get(cacheKey)!.add(mfeName);

    return newCount;
  }

  /**
   * Decrement reference count for a cache key from an MFE
   */
  decrement(cacheKey: string, mfeName: string): number {
    const subscribers = this.state.subscribers.get(cacheKey);

    // Only decrement if this MFE is actually subscribed
    if (!subscribers || !subscribers.has(mfeName)) {
      return this.state.counts.get(cacheKey) ?? 0;
    }

    const currentCount = this.state.counts.get(cacheKey) ?? 0;
    const newCount = Math.max(0, currentCount - 1);

    if (newCount === 0) {
      this.state.counts.delete(cacheKey);
      this.state.subscribers.delete(cacheKey);
    } else {
      this.state.counts.set(cacheKey, newCount);
      subscribers.delete(mfeName);
    }

    return newCount;
  }

  /**
   * Clear all refs for a cache key (used when cache is removed without MFE context)
   */
  clearCacheKey(cacheKey: string): void {
    this.state.counts.delete(cacheKey);
    this.state.subscribers.delete(cacheKey);
  }

  /**
   * Check if an MFE is already subscribed to a cache key
   */
  isSubscribed(cacheKey: string, mfeName: string): boolean {
    const subscribers = this.state.subscribers.get(cacheKey);
    return subscribers?.has(mfeName) ?? false;
  }

  /**
   * Get current reference count for a cache key
   */
  getCount(cacheKey: string): number {
    return this.state.counts.get(cacheKey) ?? 0;
  }

  /**
   * Check if cache entry should be kept (has active subscribers)
   */
  shouldKeepCache(cacheKey: string): boolean {
    return this.getCount(cacheKey) > 0;
  }

  /**
   * Get subscribers for a cache key
   */
  getSubscribers(cacheKey: string): string[] {
    const subscribers = this.state.subscribers.get(cacheKey);
    return subscribers ? Array.from(subscribers) : [];
  }

  /**
   * Cleanup all references for an MFE (when it unmounts)
   */
  cleanupMfe(mfeName: string): string[] {
    const removedKeys: string[] = [];

    for (const [cacheKey, subscribers] of this.state.subscribers) {
      if (subscribers.has(mfeName)) {
        const newCount = this.decrement(cacheKey, mfeName);
        if (newCount === 0) {
          removedKeys.push(cacheKey);
        }
      }
    }

    return removedKeys;
  }

  /**
   * Get statistics for debugging
   */
  getStats(): RefCountStats {
    const byMfe: Record<string, number> = {};
    const byCacheKey: Record<string, { count: number; subscribers: string[] }> = {};

    for (const [cacheKey, subscribers] of this.state.subscribers) {
      const subscriberList = Array.from(subscribers);
      byCacheKey[cacheKey] = {
        count: this.state.counts.get(cacheKey) ?? 0,
        subscribers: subscriberList,
      };

      for (const mfe of subscriberList) {
        byMfe[mfe] = (byMfe[mfe] ?? 0) + 1;
      }
    }

    return {
      totalCacheKeys: this.state.counts.size,
      totalSubscriptions: Array.from(this.state.counts.values()).reduce((a, b) => a + b, 0),
      byMfe,
      byCacheKey,
    };
  }

  /**
   * Reset all reference counts (for testing)
   */
  reset(): void {
    this.state.counts.clear();
    this.state.subscribers.clear();
  }
}

// Export singleton instance
export const refCountManager = new RefCountManagerImpl();

// Export class for testing
export { RefCountManagerImpl as RefCountManager };
