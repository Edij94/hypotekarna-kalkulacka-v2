import { defineConfig } from 'vitest/config';

// Default environment is node, so a DOM global fails the pure-module unit tests.
// Integration tests opt into jsdom with a `@vitest-environment jsdom` docblock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
  },
});
