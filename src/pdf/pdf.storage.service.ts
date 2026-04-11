import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly baseDir: string;

    constructor(private config: ConfigService) {
        const baseDirektory = this.config.get<string>('app.file.tempDir');

        if (!baseDirektory) throw new Error('Configuration app.file.tempDir is required but not set');
        this.baseDir = baseDirektory;

        // Pastikan base dir ada
        fs.mkdir(this.baseDir, { recursive: true }).catch(() => { });
    }

    async createJobDir(jobId: string): Promise<string> {
        const dir = path.join(this.baseDir, jobId);
        await fs.mkdir(dir, { recursive: true });
        return dir;
    }

    async cleanup(dir: string): Promise<void> {
        await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
            this.logger.warn(`Cleanup failed for ${dir}: ${err.message}`);
        });
    }

    async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(filePath).catch(() => { });
    }

    /**
     * Dipanggil oleh scheduler — hapus semua dir yang lebih tua dari TTL
     */
    async purgeExpired(): Promise<void> {
        const ttl = this.config.get<number>('app.file.ttlMs');
        if (!ttl) throw new Error('Configuration app.file.ttlMs is required but not set');

        const now = Date.now();
        let entries: string[];

        try {
            entries = await fs.readdir(this.baseDir);
        } catch { return; }

        for (const entry of entries) {
            const dir = path.join(this.baseDir, entry);
            const stat = await fs.stat(dir).catch(() => null);
            if (!stat) continue;
            if (now - stat.birthtimeMs > ttl) {
                await this.cleanup(dir);
                this.logger.log(`Purged expired job dir: ${entry}`);
            }
        }
    }
}