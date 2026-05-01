import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Sse,
  Query,
  Res,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PdfService } from './pdf.service';
import { PDF_QUEUE } from './pdf.processor.service';
import { BasicAuthGuard } from 'src/common/guards/basic-auth.guard';
import { FileValidationInterceptor } from 'src/common/interceptors/file-validation.interceptor';
import { Queue } from 'bullmq';
import { Observable } from 'rxjs';
import type { Response } from 'express';

@Controller('pdf')
@UseGuards(BasicAuthGuard)
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    @InjectQueue(PDF_QUEUE) private queue: Queue
  ) { }

  @Post('compress')
  @Throttle({
    default: {
      limit: 5, ttl: 60_000
    }
  })  // 5 request/menit
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }
    }),
    FileValidationInterceptor
  )
  async createCompressed(
    @UploadedFile() file: Express.Multer.File
  ) {
    const { jobId, downloadToken } = await this.pdfService
      .enqueue(
        file.buffer,
        file.originalname,
      );

    return {
      jobId,
      downloadToken,
      statusUrl: `/pdf/job/${jobId}/status`,
      progressUrl: `/pdf/job/${jobId}/progress`,
      downloadUrl: `/pdf/job/${jobId}/download?token=${downloadToken}`,
    };
  }

  @Get('job/:id/status')
  getStatus(@Param('id') id: string) {
    return this.pdfService.getStatus(id);
  }

  /**
   * SSE endpoint — client subscribe dan dapat progress real-time
   * GET /pdf/job/:id/progress
   */
  @Sse('job/:id/progress')
  progress(@Param('id') id: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const interval = setInterval(async () => {
        const status = await this.pdfService
          .getStatus(id)
          .catch(() => null);

        if (!status) {
          subscriber.complete();
          clearInterval(interval);
          return;
        }

        subscriber.next({ data: status } as MessageEvent);

        if (status.state === 'completed' || status.state === 'failed') {
          subscriber.complete();
          clearInterval(interval);
        }
      }, 1500);

      return () => clearInterval(interval);
    });
  }

  @Get('job/:id/download')
  async download(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const filePath = await this.pdfService.getDownloadStream(id, token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${id}-compressed.pdf"`);
    res.download(filePath, `${id}-compressed.pdf`, async () => {
      // Hapus file setelah download berhasil
      await import('fs/promises').then(f => f.unlink(filePath).catch(() => { }));
    });
  }
}
