import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { PDF_QUEUE, PdfJobData } from './pdf.processor.service';
import { StorageService } from './pdf.storage.service';
import { GhostscriptService } from './ghostscript.service';
import { generateDownloadToken, verifyDownloadToken } from '../common/utils/file.util';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { join } from 'path';
import { access, writeFile } from 'fs/promises';

@Injectable()
export class PdfService {
  constructor(
    @InjectQueue(PDF_QUEUE) private queue: Queue,
    private storage: StorageService,
    private config: ConfigService,
    private gs: GhostscriptService,
  ) { }

  async enqueue(fileBuffer: Buffer, originalName: string) {
    // ── 1. Fail-fast: Ghostscript harus tersedia sebelum accept job ──
    if (!this.gs.isAvailable()) {
      throw new ServiceUnavailableException(
        'PDF compression is unavailable: Ghostscript is not installed on this server. ' +
        'Please contact the administrator.',
      );
    }

    // ── 2. Validasi config token ──────────────────────────────────────
    const secret = this.config.get<string>('app.downloadTokenSecret');
    if (!secret) throw new UnauthorizedException('Token secret not configured');

    // ── 3. Buat job dir dan simpan file input ─────────────────────────
    const jobId = uuid();
    const tmpDir = await this.storage.createJobDir(jobId);
    const inputPath = join(tmpDir, 'input.pdf');
    await writeFile(inputPath, fileBuffer);

    const jobData: PdfJobData = {
      jobId,
      filePath: inputPath,
      tempDir: tmpDir,
      originalName,
    };

    // ── 4. Masukkan ke antrian ────────────────────────────────────────
    await this.queue.add('compress', jobData, {
      jobId,
      attempts: this.config.get('app.queue.maxAttempts'),
      backoff: {
        type: 'exponential',
        delay: this.config.get('app.queue.backoffMs'),
      },
      removeOnComplete: { age: 15 * 60 },
      removeOnFail: { age: 60 * 60 },
    });

    const downloadToken = generateDownloadToken(jobId, secret);
    return { jobId, downloadToken };
  }

  async getStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');

    const state = await job.getState();
    const progress = job.progress as number;

    return {
      jobId,
      state,
      progress,
      attempts: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      result: state === 'completed' ? job.returnvalue : null,
    };
  }

  async getDownloadStream(jobId: string, token: string) {
    const secret = this.config.get<string>('app.downloadTokenSecret');
    if (!secret) throw new UnauthorizedException('Token secret not configured');

    if (!verifyDownloadToken(jobId, token, secret)) {
      throw new ForbiddenException('Invalid download token');
    }

    const job = await this.queue.getJob(jobId);
    if (!job || await job.getState() !== 'completed') {
      throw new NotFoundException('File not ready');
    }

    const outputPath = (job.returnvalue as any).outputPath;
    await access(outputPath);
    return outputPath;
  }
}
