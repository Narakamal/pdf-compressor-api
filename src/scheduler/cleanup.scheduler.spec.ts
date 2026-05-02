import { Test, TestingModule } from '@nestjs/testing';
import { CleanupScheduler } from './cleanup.scheduler';
import { StorageService } from '../pdf/pdf.storage.service';

const mockStorage = {
  purgeExpired: jest.fn().mockResolvedValue(undefined),
};

describe('CleanupScheduler', () => {
  let scheduler: CleanupScheduler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupScheduler,
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    scheduler = module.get<CleanupScheduler>(CleanupScheduler);
  });

  it('harus instance CleanupScheduler berhasil dibuat', () => {
    expect(scheduler).toBeDefined();
  });

  it('purge() harus memanggil storage.purgeExpired()', async () => {
    await scheduler.purge();
    expect(mockStorage.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('purge() tidak boleh throw jika purgeExpired gagal', async () => {
    mockStorage.purgeExpired.mockRejectedValueOnce(new Error('storage error'));
    await expect(scheduler.purge()).rejects.toThrow('storage error');
  });
});
