import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './pdf.storage.service';
import { ConfigService } from '@nestjs/config';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn(),
  rm: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, any> = {
      'app.file.tempDir': '/tmp/pdf-jobs',
      'app.file.ttlMs': 15 * 60 * 1000, // 15 menit
    };
    return map[key];
  }),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe('createJobDir()', () => {
    it('harus buat direktori job dan return path yang benar', async () => {
      const jobId = 'test-job-uuid-123';
      const dir = await service.createJobDir(jobId);

      expect(dir).toBe(path.join('/tmp/pdf-jobs', jobId));
      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        path.join('/tmp/pdf-jobs', jobId),
        { recursive: true },
      );
    });
  });

  describe('cleanup()', () => {
    it('harus hapus direktori secara rekursif', async () => {
      const dir = '/tmp/pdf-jobs/some-job';
      await service.cleanup(dir);

      expect(fsPromises.rm).toHaveBeenCalledWith(dir, {
        recursive: true,
        force: true,
      });
    });

    it('tidak boleh throw jika rm gagal (graceful)', async () => {
      (fsPromises.rm as jest.Mock).mockRejectedValueOnce(
        new Error('Permission denied'),
      );
      await expect(service.cleanup('/tmp/pdf-jobs/bad')).resolves.toBeUndefined();
    });
  });

  describe('deleteFile()', () => {
    it('harus hapus file', async () => {
      const filePath = '/tmp/pdf-jobs/job-1/input.pdf';
      await service.deleteFile(filePath);
      expect(fsPromises.unlink).toHaveBeenCalledWith(filePath);
    });

    it('tidak boleh throw jika file tidak ada', async () => {
      (fsPromises.unlink as jest.Mock).mockRejectedValueOnce(
        new Error('ENOENT'),
      );
      await expect(
        service.deleteFile('/tmp/tidak-ada.pdf'),
      ).resolves.toBeUndefined();
    });
  });

  describe('purgeExpired()', () => {
    it('harus hapus direktori yang sudah melewati TTL', async () => {
      const now = Date.now();
      const oldBirthtime = now - 20 * 60 * 1000; // 20 menit lalu (> 15 menit TTL)

      (fsPromises.readdir as jest.Mock).mockResolvedValue(['old-job']);
      (fsPromises.stat as jest.Mock).mockResolvedValue({
        birthtimeMs: oldBirthtime,
      });

      await service.purgeExpired();

      expect(fsPromises.rm).toHaveBeenCalledWith(
        path.join('/tmp/pdf-jobs', 'old-job'),
        { recursive: true, force: true },
      );
    });

    it('tidak boleh hapus direktori yang belum melewati TTL', async () => {
      const now = Date.now();
      const recentBirthtime = now - 5 * 60 * 1000; // 5 menit lalu (< 15 menit TTL)

      (fsPromises.readdir as jest.Mock).mockResolvedValue(['new-job']);
      (fsPromises.stat as jest.Mock).mockResolvedValue({
        birthtimeMs: recentBirthtime,
      });

      await service.purgeExpired();
      expect(fsPromises.rm).not.toHaveBeenCalled();
    });

    it('harus handle jika baseDir tidak ada (readdir gagal)', async () => {
      (fsPromises.readdir as jest.Mock).mockRejectedValue(
        new Error('ENOENT: no such file or directory'),
      );
      await expect(service.purgeExpired()).resolves.toBeUndefined();
    });

    it('harus skip entri yang stat-nya gagal', async () => {
      (fsPromises.readdir as jest.Mock).mockResolvedValue(['ghost-job']);
      (fsPromises.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      await service.purgeExpired();
      expect(fsPromises.rm).not.toHaveBeenCalled();
    });
  });
});
