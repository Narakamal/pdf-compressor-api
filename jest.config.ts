export default {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: { '^.+\\.(t|j)s$': 'ts-jest' },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',

    // Pisah unit test dan e2e
    projects: [
        {
            displayName: 'unit',
            testMatch: ['<rootDir>/**/*.spec.ts'],
            testPathIgnorePatterns: ['e2e'],
        },
        {
            displayName: 'e2e',
            testMatch: ['<rootDir>/**/*.e2e-spec.ts'],
        },
    ],
};