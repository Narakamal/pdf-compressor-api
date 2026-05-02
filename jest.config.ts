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

    // ✅ Fix: uuid v9+ dan beberapa package lain ship ESM-only di dist-node.
    // Petakan ke build CJS agar Jest (CommonJS) bisa require() mereka.
    moduleNameMapper: {
        '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
        '^src/(.*)$': '<rootDir>/src/$1',
    },

    // ✅ Fix: Jangan ignore transformasi untuk package ESM berikut.
    // Default Jest mengabaikan semua node_modules — override untuk uuid & bullmq.
    transformIgnorePatterns: [
        '/node_modules/(?!(uuid|bullmq|@nestjs/bullmq)/)',
    ],

    // Pola file test — cari semua *.spec.ts kecuali folder e2e
    testMatch: [
        '<rootDir>/src/**/*.spec.ts',
    ],

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