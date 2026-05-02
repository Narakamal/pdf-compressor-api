import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import { copyFileSync, statSync } from 'fs';
import { platform } from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface CompressResult {
    outputPath: string;
    sizeBefore: number;
    sizeAfter: number;
    ratio: number;
    skipped?: boolean;
    skipReason?: string;
}

export class GhostscriptNotInstalledError extends Error {
    constructor() {
        super(
            'Ghostscript is not installed on this server. ' +
            'Windows: choco install ghostscript  |  Ubuntu: sudo apt install ghostscript',
        );
        this.name = 'GhostscriptNotInstalledError';
    }
}

@Injectable()
export class GhostscriptService implements OnApplicationBootstrap {
    private readonly logger = new Logger(GhostscriptService.name);

    private gsBinary: string | null = null;
    private gsChecked = false;

    async onApplicationBootstrap(): Promise<void> {
        await this.detectGs();
    }

    /**
     * True jika Ghostscript tersedia di sistem — cached setelah startup.
     * Digunakan oleh PdfService untuk early-rejection sebelum enqueue.
     */
    isAvailable(): boolean {
        return this.gsChecked && this.gsBinary !== null;
    }

    private async detectGs(): Promise<void> {
        const binary = this.resolveGsBinary();
        try {
            const { stdout } = await execAsync(
                platform() === 'win32' ? `"${binary}" --version` : `${binary} --version`,
                { timeout: 5_000 }
            );
            this.gsBinary = binary;
            this.gsChecked = true;
            this.logger.log(`✅ Ghostscript ready: v${stdout.trim()} (${binary})`);
        } catch {
            this.gsBinary = null;
            this.gsChecked = true;
            this.logger.warn(
                '⚠️  Ghostscript not found. PDF compression unavailable. ' +
                'Windows: choco install ghostscript | Ubuntu: sudo apt install ghostscript'
            );
        }
    }

    private resolveGsBinary(): string {
        if (platform() === 'win32') {
            const candidates = [
                'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe',
                'C:\\Program Files\\gs\\gs10.03.1\\bin\\gswin64c.exe',
                'C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe',
                'C:\\Program Files (x86)\\gs\\gs10.04.0\\bin\\gswin32c.exe',
                'gswin64c',
            ];
            for (const c of candidates) {
                try {
                    if (c.includes('\\')) statSync(c);
                    return c;
                } catch {
                    // next candidate
                }
            }
            return 'gswin64c';
        }
        return 'gs';
    }

    async checkGsAvailable(): Promise<string | null> {
        const binary = this.resolveGsBinary();
        try {
            const cmd = platform() === 'win32'
                ? `"${binary}" --version`
                : `${binary} --version`;
            const { stdout } = await execAsync(cmd, { timeout: 5_000 });
            this.logger.log(`Ghostscript available: v${stdout.trim()} (${binary})`);
            return binary;
        } catch {
            this.logger.warn(`Ghostscript not found (binary: ${binary}).`);
            return null;
        }
    }

    /**
     * Compress PDF.
     * @param strict  true  → throw GhostscriptNotInstalledError jika GS tidak ada
     *                false → copy file tanpa kompresi (graceful fallback)
     */
    async compress(
        inputPath: string,
        outputDir: string,
        onProgress?: (pct: number) => void,
        strict = true,
    ): Promise<CompressResult> {
        if (!this.gsChecked) await this.detectGs();

        const sizeBefore = statSync(inputPath).size;
        const outputPath = join(outputDir, 'compressed.pdf');

        if (!this.gsBinary) {
            if (strict) throw new GhostscriptNotInstalledError();

            // Graceful fallback (hanya jika strict=false dipanggil eksplisit)
            this.logger.warn('GS not available — copying file as-is.');
            copyFileSync(inputPath, outputPath);
            onProgress?.(100);
            return {
                outputPath,
                sizeBefore,
                sizeAfter: sizeBefore,
                ratio: 0,
                skipped: true,
                skipReason: 'Ghostscript is not installed on this server.',
            };
        }

        await this.runGs(this.gsBinary, inputPath, outputPath, onProgress);
        const sizeAfter = statSync(outputPath).size;

        return {
            outputPath,
            sizeBefore,
            sizeAfter,
            ratio: Math.round((1 - sizeAfter / sizeBefore) * 100),
        };
    }

    private runGs(
        binary: string,
        input: string,
        output: string,
        onProgress?: (pct: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = [
                '-dNOPAUSE', '-dBATCH', '-dSAFER',
                '-sDEVICE=pdfwrite',
                '-dCompatibilityLevel=1.4',
                '-dPDFSETTINGS=/ebook',
                '-dColorImageResolution=150',
                '-dGrayImageResolution=150',
                '-dMonoImageResolution=150',
                `-sOutputFile=${output}`,
                input,
            ];

            this.logger.debug(`Spawn GS: ${binary} ${args.join(' ')}`);

            const gs = spawn(binary, args, {
                timeout: 120_000,
                killSignal: 'SIGKILL',
                shell: platform() === 'win32',
            });

            let stderr = '';

            gs.stderr.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                stderr += text;
                const match = text.match(/Page (\d+)/);
                if (match && onProgress) {
                    onProgress(Math.min(90, parseInt(match[1]) * 5));
                }
            });

            gs.on('close', (code) => {
                if (code === 0) {
                    onProgress?.(100);
                    resolve();
                } else {
                    reject(new Error(`Ghostscript exit code ${code}: ${stderr}`));
                }
            });

            gs.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ENOENT') {
                    reject(new GhostscriptNotInstalledError());
                } else {
                    reject(err);
                }
            });
        });
    }
}
