import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetRegistry } from '../core/globalRegistry';
import { urlInvalidationManager } from '../invalidation/urlInvalidationManager';
import { setDebugLogging } from '../core/logger';

// Keep logs quiet during tests; individual tests opt in if needed.
setDebugLogging(false);

afterEach(() => {
  cleanup();
  // resetRegistry clears the registry, shared store, refcounts, and request tracker.
  resetRegistry();
  // The URL invalidation manager is a window singleton; fully reset it too.
  urlInvalidationManager.reset();
});
