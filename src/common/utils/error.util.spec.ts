import {
  getHttpError,
  getErrorMessage,
  getErrorStatus,
  isError,
  isHttpException,
} from './error.util';
import {
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

describe('ErrorUtil', () => {
  describe('isError()', () => {
    it('harus return true untuk instance Error', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('type error'))).toBe(true);
    });

    it('harus return false untuk non-Error', () => {
      expect(isError('string')).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError({ message: 'fake' })).toBe(false);
    });
  });

  describe('isHttpException()', () => {
    it('harus return true untuk HttpException NestJS', () => {
      expect(isHttpException(new NotFoundException())).toBe(true);
      expect(isHttpException(new BadRequestException())).toBe(true);
    });

    it('harus return false untuk Error biasa', () => {
      expect(isHttpException(new Error('plain error'))).toBe(false);
    });
  });

  describe('getHttpError()', () => {
    it('harus parse NotFoundException dengan benar', () => {
      const error = new NotFoundException('Data tidak ditemukan');
      const result = getHttpError(error);

      expect(result.statusCode).toBe(404);
      expect(result.message).toBe('Data tidak ditemukan');
      expect(result.isHttpException).toBe(true);
    });

    it('harus parse BadRequestException dengan array message', () => {
      const error = new BadRequestException(['field wajib diisi', 'email tidak valid']);
      const result = getHttpError(error);

      expect(result.statusCode).toBe(400);
      expect(Array.isArray(result.message)).toBe(true);
      expect(result.isHttpException).toBe(true);
    });

    it('harus parse Error JS standar sebagai 500', () => {
      const error = new TypeError('Cannot read property of undefined');
      const result = getHttpError(error);

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Cannot read property of undefined');
      expect(result.isHttpException).toBe(false);
    });

    it('harus parse string error sebagai 500', () => {
      const result = getHttpError('something went wrong');
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('something went wrong');
    });

    it('harus parse object dengan statusCode dan message', () => {
      const result = getHttpError({ statusCode: 503, message: 'Service unavailable' });
      expect(result.statusCode).toBe(503);
      expect(result.message).toBe('Service unavailable');
    });

    it('harus fallback 500 untuk error yang tidak dikenal', () => {
      const result = getHttpError(undefined);
      expect(result.statusCode).toBe(500);
      expect(typeof result.message).toBe('string');
    });

    it('harus include stack trace untuk HttpException', () => {
      const error = new NotFoundException('not found');
      const result = getHttpError(error);
      expect(result.stack).toBeDefined();
    });
  });

  describe('getErrorMessage()', () => {
    it('harus return message string dari HttpException', () => {
      const msg = getErrorMessage(new NotFoundException('Tidak ada'));
      expect(msg).toBe('Tidak ada');
    });

    it('harus return message dari Error standar', () => {
      const msg = getErrorMessage(new Error('crash'));
      expect(msg).toBe('crash');
    });
  });

  describe('getErrorStatus()', () => {
    it('harus return 404 untuk NotFoundException', () => {
      expect(getErrorStatus(new NotFoundException())).toBe(404);
    });

    it('harus return 500 untuk Error standar', () => {
      expect(getErrorStatus(new Error('crash'))).toBe(500);
    });

    it('harus return 400 untuk BadRequestException', () => {
      expect(getErrorStatus(new BadRequestException())).toBe(400);
    });
  });
});
