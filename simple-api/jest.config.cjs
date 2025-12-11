module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: ['index.js'],
  coverageDirectory: './coverage',
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
