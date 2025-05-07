module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  // Force Jest to mock the @xenova/transformers module
  moduleNameMapper: {
    "^@xenova/transformers$": "<rootDir>/src/__mocks__/transformers.js"
  },
  // Ignore node_modules except specifically needed packages
  transformIgnorePatterns: [
    "node_modules/(?!(@xenova/transformers|fastmcp)/)"
  ]
};