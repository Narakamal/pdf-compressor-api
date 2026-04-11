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
    skipped?: boolean;      // true jika GS tidak tersedia, file dicopy saja
    skipReason?: string;
}

export class GhostscriptNotInstalledError extends Error {
    constructor() {
        super(
            'Ghostscript tidak terinstal. ' +
            'Windows: choco install ghostscript  |  Ubuntu: sudo apt install ghostscript',
        );
        this.name = 'GhostscriptNotInstalledError';
    }
}

@Injectable()
export class GhostscriptService implements OnApplicationBootstrap {
    private readonly logger = new Logger(GhostscriptService.name);

    // Cache hasil deteksi — tidak perlu cek ulang tiap request
    private gsBinary: string | null = null;
    private gsChecked = false;

    /**
     * Dipanggil otomatis NestJS setelah semua module terinisialisasi
     */
    async onApplicationBootstrap(): Promise<void> {
        await this.detectGs();
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
            // Warn, bukan error — supaya app tetap bisa start
            this.logger.warn(
                '⚠️  Ghostscript tidak ditemukan saat startup. ' +
                'Fitur kompresi PDF tidak tersedia. ' +
                'Windows: choco install ghostscript | Ubuntu: sudo apt install ghostscript'
            );
        }
    }

    /**
     * Resolve binary GS sesuai OS.
     * Windows → cari di lokasi default Ghostscript installer (Program Files)
     * Linux   → 'gs' (dari PATH)
     */
    private resolveGsBinary(): string {
        if (platform() === 'win32') {
            // Ghostscript di Windows biasanya install ke folder bernama versi
            // Coba beberapa path umum; fallback ke 'gswin64c' jika ada di PATH
            const candidates = [
                'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe',
                'C:\\Program Files\\gs\\gs10.03.1\\bin\\gswin64c.exe',
                'C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe',
                'C:\\Program Files (x86)\\gs\\gs10.04.0\\bin\\gswin32c.exe',
                'gswin64c',   // jika sudah ada di PATH Windows
            ];

            for (const c of candidates) {
                try {
                    // statSync hanya valid untuk path absolut
                    if (c.includes('\\')) statSync(c);
                    return c;
                } catch {
                    // lanjut ke kandidat berikutnya
                }
            }
            return 'gswin64c';   // last-resort, biarkan OS lempar error
        }

        return 'gs';   // Linux / macOS
    }

    /**
     * Cek apakah Ghostscript tersedia di sistem.
     * Mengembalikan path binary jika ada, null jika tidak ada.
     */
    async checkGsAvailable(): Promise<string | null> {
        const binary = this.resolveGsBinary();

        try {
            const cmd =
                platform() === 'win32'
                    ? `"${binary}" --version`
                    : `${binary} --version`;

            const { stdout } = await execAsync(cmd, { timeout: 5_000 });
            const version = stdout.trim();
            this.logger.log(`Ghostscript tersedia: v${version} (${binary})`);
            return binary;
        } catch {
            this.logger.warn(
                `Ghostscript tidak ditemukan (binary: ${binary}). ` +
                'Kompresi PDF akan dilewati.',
            );
            return null;
        }
    }

    /**
     * Compress PDF.
     *
     * @param strict  true  → lempar GhostscriptNotInstalledError jika GS tidak ada
     *                false → copy file tanpa kompresi, kembalikan skipped:true
     */
    async compress(
        inputPath: string,
        outputDir: string,
        onProgress?: (pct: number) => void,
        strict = false,
    ): Promise<CompressResult> {
        // Gunakan cache — tidak spawn process baru tiap request
        if (!this.gsChecked) await this.detectGs();

        const sizeBefore = statSync(inputPath).size;
        const outputPath = join(outputDir, 'compressed.pdf');

        if (!this.gsBinary) {
            if (strict) throw new GhostscriptNotInstalledError();

            // Graceful fallback: copy as-is
            this.logger.warn(
                'GS tidak tersedia – file di-copy tanpa kompresi.',
            );
            copyFileSync(inputPath, outputPath);
            onProgress?.(100);

            return {
                outputPath,
                sizeBefore,
                sizeAfter: sizeBefore,
                ratio: 0,
                skipped: true,
                skipReason: 'Ghostscript tidak terinstal di server ini.',
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
                // Windows butuh shell:true jika binary dari PATH tidak resolve
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
                    reject(
                        new Error(`Ghostscript exit code ${code}: ${stderr}`),
                    );
                }
            });

            gs.on('error', (err: NodeJS.ErrnoException) => {
                // ENOENT = binary tidak ketemu (race condition / salah path)
                if (err.code === 'ENOENT') {
                    reject(new GhostscriptNotInstalledError());
                } else {
                    reject(err);
                }
            });
        });
    }
}