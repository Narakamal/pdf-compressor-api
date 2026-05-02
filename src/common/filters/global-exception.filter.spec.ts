import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function mockHost(method = 'GET', url = '/test') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method, url };

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost,
    json,
    status,
  };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('harus handle NotFoundException dengan statusCode 404', () => {
    const { host, status, json } = mockHost();
    filter.catch(new NotFoundException('Resource tidak ditemukan'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        message: 'Resource tidak ditemukan',
      }),
    );
  });

  it('harus handle BadRequestException dengan statusCode 400', () => {
    const { host, status } = mockHost('POST', '/pdf/compress');
    filter.catch(new BadRequestException('File tidak valid'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('harus handle UnauthorizedException dengan statusCode 401', () => {
    const { host, status } = mockHost();
    filter.catch(new UnauthorizedException(), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
  });

  it('harus handle ForbiddenException dengan statusCode 403', () => {
    const { host, status } = mockHost();
    filter.catch(new ForbiddenException('Akses ditolak'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
  });

  it('harus handle Error standar sebagai 500 Internal Server Error', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('Database connection failed'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        message: 'Database connection failed',
      }),
    );
  });

  it('harus handle string error sebagai 500', () => {
    const { host, status } = mockHost();
    filter.catch('something went wrong', host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('harus handle error unknown sebagai 500', () => {
    const { host, status } = mockHost();
    filter.catch({ some: 'unknown object' }, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('response harus mengandung path dan timestamp', () => {
    const { host, json } = mockHost('POST', '/pdf/compress');
    filter.catch(new BadRequestException('invalid'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/pdf/compress',
        timestamp: expect.any(String),
      }),
    );
  });
});
