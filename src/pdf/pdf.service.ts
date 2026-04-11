import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { PDF_QUEUE, PdfJobData } from './pdf.processor.service';
import { StorageService } from './pdf.storage.service';
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
  ) { }

  async enqueue(fileBuffer: Buffer, originalName: string) {
    // ✅ Fail-fast: validasi config SEBELUM ada I/O apapun
    const secret = this.config.get<string>('app.downloadTokenSecret');
    if (!secret) throw new UnauthorizedException('Token secret not configured');

    const jobId = uuid();
    const tmpDir = await this.storage.createJobDir(jobId);

    // Simpan file input ke temp dir
    const inputPath = join(tmpDir, 'input.pdf');
    await writeFile(inputPath, fileBuffer);

    const jobData: PdfJobData = {
      jobId,
      filePath: inputPath,
      tempDir: tmpDir,
      originalName,
    };

    await this.queue.add('compress', jobData, {
      jobId,
      attempts: this.config.get('app.queue.maxAttempts'),
      backoff: {
        type: 'exponential',
        delay: this.config.get('app.queue.backoffMs'),
      },
      removeOnComplete: { age: 15 * 60 },  // hapus dari queue setelah 15 menit
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
      state,         // waiting | active | completed | failed | delayed
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
    await access(outputPath); // pastikan file masih ada
    return outputPath;
  }
}