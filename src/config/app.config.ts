import { registerAs } from '@nestjs/config';
import { join } from 'path';
import { tmpdir } from 'os';

export default registerAs('app', () => ({
    basicAuthUser: process.env.BASIC_AUTH_USER,
    basicAuthPass: process.env.BASIC_AUTH_PASS,
    hmacSecret: process.env.HMAC_SECRET,
    authMode: process.env.AUTH_MODE ?? 'basic', // 'basic' | 'hmac'

    file: {
        minBytes: 10 * 1024,          // 10 KB
        maxBytes: 50 * 1024 * 1024,   // 50 MB
        // Dev (Windows/Linux): pakai OS temp dir — tidak kotor direktori project
        // Production: override via TEMP_DIR env var ke path server yang persisten
        tempDir: process.env.TEMP_DIR ?? join(tmpdir(), 'pdf-jobs'),
        ttlMs: 15 * 60 * 1000,     // 15 menit auto-delete
    },

    queue: {
        concurrency: 3,
        maxAttempts: 3,
        backoffMs: 3000,
    },

    downloadTokenSecret: process.env.DOWNLOAD_TOKEN_SECRET,
}));
