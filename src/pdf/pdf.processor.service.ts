import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GhostscriptService } from './ghostscript.service';
import { StorageService } from './pdf.storage.service';
import { getErrorMessage } from 'src/common/utils/error.util';

export const PDF_QUEUE = 'pdf-compress';

export interface PdfJobData {
    jobId: string;
    filePath: string;  // path temp file input
    tempDir: string;
    originalName?: string;
}

@Processor(PDF_QUEUE)
export class PdfProcessor extends WorkerHost {
    private readonly logger = new Logger(PdfProcessor.name);

    constructor(
        private readonly gs: GhostscriptService,
        private readonly storage: StorageService,
    ) { super(); }

    async process(job: Job<PdfJobData>): Promise<void> {
        const { jobId, filePath, tempDir } = job.data;
        this.logger.log(`Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

        try {
            await job.updateProgress(5);

            const result = await this.gs.compress(filePath, tempDir, async (pct) => {
                await job.updateProgress(pct);
            });

            // Simpan metadata hasil ke Redis via BullMQ returnvalue
            await job.updateProgress(100);
            return {
                sizeBefore: result.sizeBefore,
                sizeAfter: result.sizeAfter,
                ratio: result.ratio,
                outputPath: result.outputPath,
            } as any;

        } catch (err) {
            this.logger.error(`Job ${jobId} failed: ${err.message}`);

            // Cleanup input jika gagal total (setelah semua retry)
            // ✅ Safe: fallback ke 1 jika attempts tidak didefinisikan
            const maxAttempts = job.opts?.attempts ?? 1;
            const isLastAttempt = job.attemptsMade >= maxAttempts - 1;

            if (isLastAttempt) {
                await this.storage.cleanup(tempDir);
            }

            throw getErrorMessage(err); // BullMQ akan retry otomatis
        }
    }

    @OnWorkerEvent('completed')
    async onCompleted(job: Job<PdfJobData>) {
        this.logger.log(`Job ${job.data.jobId} completed`);
        // Hapus file INPUT — output masih disimpan untuk download
        await this.storage.deleteFile(job.data.filePath);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<PdfJobData>, err: Error) {
        this.logger.error(`Job ${job.data.jobId} permanently failed: ${err.message}`);
    }
}