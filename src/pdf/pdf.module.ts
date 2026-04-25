import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { BullModule } from '@nestjs/bullmq';
import { PDF_QUEUE, PdfProcessor } from './pdf.processor.service';
import { ConfigService } from '@nestjs/config';
import { GhostscriptService } from './ghostscript.service';
import { StorageService } from './pdf.storage.service';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: PDF_QUEUE,
      useFactory: (config: ConfigService) => ({
        connection: {
          password: config.get('REDIS_PASSWORD', ''),
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: config.get('app.queue.maxAttempts'),
          backoff: { type: 'exponential', delay: 3000 },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PdfController],
  providers: [
    PdfService,
    PdfProcessor,
    GhostscriptService,
    StorageService
  ],
})
export class PdfModule { }
