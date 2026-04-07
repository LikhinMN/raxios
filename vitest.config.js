const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20000,
    include: ['tests/**/*.test.mjs']
  }
})
