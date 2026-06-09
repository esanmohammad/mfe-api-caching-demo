/**
 * Request Tracker
 * Tracks all API requests and enables request coalescing across MFEs
 */

export interface TrackedRequest {
  id: string;
  cacheKey: string;
  endpoint: string;
  type: 'query' | 'mutation';
  timestamp: number;
  mfeSource: string | null;
  status: 'pending' | 'fulfilled' | 'rejected';
  duration?: number;
  error?: unknown;
}

export interface RequestTrackerStats {
  activeRequests: number;
  inFlightCoalesced: number;
  totalRequests: number;
  totalCoalesced: number;
  byEndpoint: Record<string, number>;
  byMfe: Record<string, number>;
}

class RequestTrackerImpl {
  private requests = new Map<string, TrackedRequest>();
  private inFlightRequests = new Map<string, Promise<unknown>>();
  private history: TrackedRequest[] = [];
  private coalescedCount = 0;
  private maxHistorySize = 1000;

  /**
   * Start tracking a new request
   */
  startRequest(
    id: string,
    info: Omit<TrackedRequest, 'id' | 'status' | 'duration'>
  ): void {
    const request: TrackedRequest = {
      ...info,
      id,
      status: 'pending',
    };
    this.requests.set(id, request);
  }

  /**
   * Get an in-flight request by cache key (for coalescing)
   */
  getInFlightRequest(cacheKey: string): Promise<unknown> | undefined {
    return this.inFlightRequests.get(cacheKey);
  }

  /**
   * Register a promise for an in-flight request
   */
  registerInFlightRequest(cacheKey: string, promise: Promise<unknown>): void {
    this.inFlightRequests.set(cacheKey, promise);
  }

  /**
   * Clear an in-flight request
   */
  clearInFlightRequest(cacheKey: string): void {
    this.inFlightRequests.delete(cacheKey);
  }

  /**
   * Record that a request was coalesced (reused existing in-flight request)
   */
  recordCoalescedRequest(cacheKey: string, mfeName: string | null): void {
    this.coalescedCount++;

    // Add to history as a coalesced request
    const coalescedEntry: TrackedRequest = {
      id: `coalesced-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      cacheKey,
      endpoint: cacheKey.split('(')[0] ?? cacheKey,
      type: 'query',
      timestamp: Date.now(),
      mfeSource: mfeName,
      status: 'fulfilled',
      duration: 0, // Instant because it was coalesced
    };

    this.addToHistory(coalescedEntry);
  }

  /**
   * Mark a request as completed successfully
   */
  completeRequest(id: string): void {
    const request = this.requests.get(id);
    if (request) {
      request.status = 'fulfilled';
      request.duration = Date.now() - request.timestamp;
      this.addToHistory(request);
      this.requests.delete(id);
    }
  }

  /**
   * Mark a request as failed
   */
  failRequest(id: string, error: unknown): void {
    const request = this.requests.get(id);
    if (request) {
      request.status = 'rejected';
      request.duration = Date.now() - request.timestamp;
      request.error = error;
      this.addToHistory(request);
      this.requests.delete(id);
    }
  }

  /**
   * Get all currently active requests
   */
  getActiveRequests(): TrackedRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get request history (most recent first)
   */
  getHistory(limit = 100): TrackedRequest[] {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get statistics
   */
  getStats(): RequestTrackerStats {
    const byEndpoint: Record<string, number> = {};
    const byMfe: Record<string, number> = {};

    for (const request of this.history) {
      byEndpoint[request.endpoint] = (byEndpoint[request.endpoint] ?? 0) + 1;
      if (request.mfeSource) {
        byMfe[request.mfeSource] = (byMfe[request.mfeSource] ?? 0) + 1;
      }
    }

    return {
      activeRequests: this.requests.size,
      inFlightCoalesced: this.inFlightRequests.size,
      totalRequests: this.history.length,
      totalCoalesced: this.coalescedCount,
      byEndpoint,
      byMfe,
    };
  }

  /**
   * Add to history with size limit
   */
  private addToHistory(request: TrackedRequest): void {
    this.history.push(request);
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Reset tracker (for testing)
   */
  reset(): void {
    this.requests.clear();
    this.inFlightRequests.clear();
    this.history = [];
    this.coalescedCount = 0;
  }
}

// Export singleton instance
export const requestTracker = new RequestTrackerImpl();

// Export class for testing
export { RequestTrackerImpl as RequestTracker };
