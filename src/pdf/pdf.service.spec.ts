import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { StorageService } from './pdf.storage.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PDF_QUEUE } from './pdf.processor.service';
import {
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { generateDownloadToken } from '../common/utils/file.util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

const mockStorage = {
  createJobDir: jest.fn(),
  cleanup: jest.fn(),
  deleteFile: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: any) => {
    const map: Record<string, any> = {
      'app.downloadTokenSecret': 'test-secret-32-chars-xxxxxxxxxxxx',
      'app.queue.maxAttempts': 3,
      'app.queue.backoffMs': 3000,
    };
    return map[key] ?? fallback;
  }),
};

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: getQueueToken(PDF_QUEUE), useValue: mockQueue },
        { provide: StorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  describe('enqueue()', () => {
    it('harus berhasil enqueue file PDF dan return jobId + downloadToken', async () => {
      const tmpDir = path.join(os.tmpdir(), 'test-job-123');
      mockStorage.createJobDir.mockResolvedValue(tmpDir);
      mockQueue.add.mockResolvedValue({});

      const buffer = Buffer.from('%PDF-1.4 test content');
      const result = await service.enqueue(buffer, 'test.pdf');

      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('downloadToken');
      expect(typeof result.jobId).toBe('string');
      expect(typeof result.downloadToken).toBe('string');
      expect(mockStorage.createJobDir).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'compress',
        expect.objectContaining({
          filePath: expect.stringContaining('input.pdf'),
          tempDir: tmpDir,
          originalName: 'test.pdf',
        }),
        expect.any(Object),
      );
    });

    it('harus throw UnauthorizedException jika downloadTokenSecret tidak dikonfigurasi', async () => {
      const configWithoutSecret = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PdfService,
          { provide: getQueueToken(PDF_QUEUE), useValue: mockQueue },
          { provide: StorageService, useValue: mockStorage },
          { provide: ConfigService, useValue: configWithoutSecret },
        ],
      }).compile();

      const svc = module.get<PdfService>(PdfService);
      await expect(
        svc.enqueue(Buffer.from('%PDF test'), 'file.pdf'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('downloadToken yang dihasilkan harus valid untuk jobId yang sama', async () => {
      const tmpDir = '/tmp/pdf-jobs/test-id';
      mockStorage.createJobDir.mockResolvedValue(tmpDir);
      mockQueue.add.mockResolvedValue({});

      const { jobId, downloadToken } = await service.enqueue(
        Buffer.from('%PDF-1.4'),
        'file.pdf',
      );

      const secret = 'test-secret-32-chars-xxxxxxxxxxxx';
      const expectedToken = generateDownloadToken(jobId, secret);
      expect(downloadToken).toBe(expectedToken);
    });
  });

  describe('getStatus()', () => {
    it('harus return status job yang benar untuk job aktif', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('active'),
        progress: 45,
        attemptsMade: 1,
        failedReason: null,
        returnvalue: null,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getStatus('job-id-123');

      expect(result).toEqual({
        jobId: 'job-id-123',
        state: 'active',
        progress: 45,
        attempts: 1,
        failedReason: null,
        result: null,
      });
    });

    it('harus return result ketika job selesai (completed)', async () => {
      const returnvalue = {
        sizeBefore: 1_000_000,
        sizeAfter: 300_000,
        ratio: 70,
        outputPath: '/tmp/pdf-jobs/job-id/compressed.pdf',
      };
      const mockJob = {
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        attemptsMade: 1,
        failedReason: null,
        returnvalue,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getStatus('job-id-123');

      expect(result.state).toBe('completed');
      expect(result.result).toEqual(returnvalue);
    });

    it('harus throw NotFoundException jika job tidak ditemukan', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      await expect(service.getStatus('tidak-ada')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('harus return failedReason ketika job gagal', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('failed'),
        progress: 0,
        attemptsMade: 3,
        failedReason: 'Ghostscript error',
        returnvalue: null,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getStatus('job-id-failed');
      expect(result.state).toBe('failed');
      expect(result.failedReason).toBe('Ghostscript error');
    });
  });

  describe('getDownloadStream()', () => {
    const jobId = 'job-download-test';
    const secret = 'test-secret-32-chars-xxxxxxxxxxxx';

    it('harus return outputPath untuk token yang valid dan job selesai', async () => {
      const token = generateDownloadToken(jobId, secret);
      const outputPath = `/tmp/pdf-jobs/${jobId}/compressed.pdf`;

      const mockJob = {
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: { outputPath },
      };
      mockQueue.getJob.mockResolvedValue(mockJob);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getDownloadStream(jobId, token);
      expect(result).toBe(outputPath);
    });

    it('harus throw ForbiddenException untuk token yang tidak valid', async () => {
      await expect(
        service.getDownloadStream(jobId, 'invalid-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('harus throw NotFoundException jika job belum selesai', async () => {
      const token = generateDownloadToken(jobId, secret);
      const mockJob = {
        getState: jest.fn().mockResolvedValue('active'),
        returnvalue: null,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.getDownloadStream(jobId, token)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('harus throw NotFoundException jika job tidak ada', async () => {
      const token = generateDownloadToken(jobId, secret);
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.getDownloadStream(jobId, token)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
