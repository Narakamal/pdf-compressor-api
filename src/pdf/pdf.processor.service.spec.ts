import { Test, TestingModule } from '@nestjs/testing';
import { PdfProcessor, PDF_QUEUE, PdfJobData } from './pdf.processor.service';
import { GhostscriptService, CompressResult } from './ghostscript.service';
import { StorageService } from './pdf.storage.service';
import { Job } from 'bullmq';
import { BullModule } from '@nestjs/bullmq';

const mockGs = {
  compress: jest.fn(),
};

const mockStorage = {
  cleanup: jest.fn().mockResolvedValue(undefined),
  deleteFile: jest.fn().mockResolvedValue(undefined),
};

function createMockJob(data: PdfJobData, overrides: Partial<Job<PdfJobData>> = {}): Job<PdfJobData> {
  return {
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
    updateProgress: jest.fn().mockResolvedValue(undefined),
    returnvalue: null,
    failedReason: null,
    ...overrides,
  } as unknown as Job<PdfJobData>;
}

describe('PdfProcessor', () => {
  let processor: PdfProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfProcessor,
        { provide: GhostscriptService, useValue: mockGs },
        { provide: StorageService, useValue: mockStorage },
      ],
    })
      .overrideProvider(PDF_QUEUE)
      .useValue({})
      .compile();

    processor = module.get<PdfProcessor>(PdfProcessor);
  });

  const jobData: PdfJobData = {
    jobId: 'proc-test-uuid',
    filePath: '/tmp/pdf-jobs/proc-test-uuid/input.pdf',
    tempDir: '/tmp/pdf-jobs/proc-test-uuid',
    originalName: 'document.pdf',
  };

  describe('process()', () => {
    it('harus berhasil compress dan return metadata ukuran file', async () => {
      const compressResult: CompressResult = {
        outputPath: '/tmp/pdf-jobs/proc-test-uuid/compressed.pdf',
        sizeBefore: 1_000_000,
        sizeAfter: 300_000,
        ratio: 70,
      };
      mockGs.compress.mockResolvedValue(compressResult);

      const job = createMockJob(jobData);
      const result = await processor.process(job);

      expect(result).toEqual({
        sizeBefore: 1_000_000,
        sizeAfter: 300_000,
        ratio: 70,
        outputPath: '/tmp/pdf-jobs/proc-test-uuid/compressed.pdf',
      });
      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('harus throw error saat compress gagal', async () => {
      mockGs.compress.mockRejectedValue(new Error('GS process failed'));

      const job = createMockJob(jobData, { attemptsMade: 2 }); // attempt terakhir
      await expect(processor.process(job)).rejects.toBeDefined();
    });

    it('harus panggil cleanup saat ini adalah attempt terakhir dan gagal', async () => {
      mockGs.compress.mockRejectedValue(new Error('fatal error'));

      const job = createMockJob(jobData, {
        attemptsMade: 2, // attempt ke-3 dari 3 = terakhir
        opts: { attempts: 3 },
      });

      await expect(processor.process(job)).rejects.toBeDefined();
      expect(mockStorage.cleanup).toHaveBeenCalledWith(jobData.tempDir);
    });

    it('tidak boleh panggil cleanup jika masih ada retry tersisa', async () => {
      mockGs.compress.mockRejectedValue(new Error('temporary error'));

      const job = createMockJob(jobData, {
        attemptsMade: 0, // attempt pertama dari 3 = masih ada retry
        opts: { attempts: 3 },
      });

      await expect(processor.process(job)).rejects.toBeDefined();
      expect(mockStorage.cleanup).not.toHaveBeenCalled();
    });

    it('harus handle GS graceful fallback (skipped=true)', async () => {
      const skipResult: CompressResult = {
        outputPath: '/tmp/pdf-jobs/proc-test-uuid/compressed.pdf',
        sizeBefore: 500_000,
        sizeAfter: 500_000,
        ratio: 0,
        skipped: true,
        skipReason: 'Ghostscript tidak terinstal di server ini.',
      };
      mockGs.compress.mockResolvedValue(skipResult);

      const job = createMockJob(jobData);
      const result = await processor.process(job);

      expect(result).toMatchObject({
        sizeBefore: 500_000,
        sizeAfter: 500_000,
        ratio: 0,
      });
    });
  });

  describe('onCompleted()', () => {
    it('harus hapus file input setelah job selesai', async () => {
      const job = createMockJob(jobData);
      await processor.onCompleted(job);
      expect(mockStorage.deleteFile).toHaveBeenCalledWith(jobData.filePath);
    });
  });
});
