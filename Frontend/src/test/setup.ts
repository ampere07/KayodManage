import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest's globals do not auto-unmount between tests the way some runners do;
// without this, queries in a later test can match nodes left behind by an
// earlier one and a genuinely broken render still passes.
afterEach(() => {
  cleanup();
});
