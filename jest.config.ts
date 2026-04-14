import type { Config } from 'jest';

const config: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',

    // Transformasi TypeScript menggunakan ts-jest
    transform: {
        '^.+\\.(t|j)s$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
        }],
    },

    // Pola file test — cari semua *.spec.ts kecuali folder e2e
    testMatch: [
        '<rootDir>/src/**/*.spec.ts',
    ],

    // Alias path jika kamu pakai @ imports di tsconfig
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },

    // Coverage
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.spec.ts',
        '!src/**/*.e2e-spec.ts',
        '!src/main.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
};

export default config;