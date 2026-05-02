import {
  ExecutionContext,
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileValidationInterceptor } from './file-validation.interceptor';
import { of } from 'rxjs';

const PDF_MAGIC = Buffer.from('%PDF-1.4 valid pdf content');
const ZIP_MAGIC = Buffer.from('PK\x03\x04 zip file content');

function makeConfigService(minBytes = 10 * 1024, maxBytes = 50 * 1024 * 1024): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'app.file.minBytes') return minBytes;
      if (key === 'app.file.maxBytes') return maxBytes;
      return undefined;
    }),
  } as unknown as ConfigService;
}

function mockContext(file?: Partial<Express.Multer.File>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ file }),
    }),
  } as ExecutionContext;
}

const mockCallHandler: CallHandler = {
  handle: () => of('next called'),
};

describe('FileValidationInterceptor', () => {
  let interceptor: FileValidationInterceptor;

  beforeEach(() => {
    interceptor = new FileValidationInterceptor(makeConfigService());
  });

  it('harus lolos untuk file PDF yang valid', () => {
    const file: Partial<Express.Multer.File> = {
      buffer: PDF_MAGIC,
      size: 50 * 1024, // 50 KB — di atas minimum 10 KB
      originalname: 'document.pdf',
    };
    const ctx = mockContext(file);
    expect(() => interceptor.intercept(ctx, mockCallHandler)).not.toThrow();
  });

  it('harus throw BadRequestException jika file tidak ada', () => {
    const ctx = mockContext(undefined);
    expect(() => interceptor.intercept(ctx, mockCallHandler)).toThrow(
      BadRequestException,
    );
  });

  it('harus throw BadRequestException jika ukuran file di bawah minimum', () => {
    const file: Partial<Express.Multer.File> = {
      buffer: PDF_MAGIC,
      size: 1024, // 1 KB — di bawah minimum 10 KB
      originalname: 'tiny.pdf',
    };
    const ctx = mockContext(file);
    expect(() => interceptor.intercept(ctx, mockCallHandler)).toThrow(
      BadRequestException,
    );
  });

  it('harus throw PayloadTooLargeException jika ukuran file melebihi maksimum', () => {
    const file: Partial<Express.Multer.File> = {
      buffer: PDF_MAGIC,
      size: 60 * 1024 * 1024, // 60 MB — melebihi 50 MB
      originalname: 'huge.pdf',
    };
    const ctx = mockContext(file);
    expect(() => interceptor.intercept(ctx, mockCallHandler)).toThrow(
      PayloadTooLargeException,
    );
  });

  it('harus throw UnprocessableEntityException jika bukan file PDF (magic bytes salah)', () => {
    const file: Partial<Express.Multer.File> = {
      buffer: ZIP_MAGIC,
      size: 50 * 1024,
      originalname: 'fake.pdf',
    };
    const ctx = mockContext(file);
    expect(() => interceptor.intercept(ctx, mockCallHandler)).toThrow(
      UnprocessableEntityException,
    );
  });

  it('harus throw UnprocessableEntityException untuk PDF bomb (terlalu banyak objects)', () => {
    const bombContent = Array.from(
      { length: 10_001 },
      (_, i) => `${i} 0 obj\n<<>>\nendobj`,
    ).join('\n');
    const file: Partial<Express.Multer.File> = {
      buffer: Buffer.concat([PDF_MAGIC, Buffer.from(bombContent)]),
      size: 100 * 1024,
      originalname: 'bomb.pdf',
    };
    const ctx = mockContext(file);
    expect(() => interceptor.intercept(ctx, mockCallHandler)).toThrow(
      UnprocessableEntityException,
    );
  });
});
