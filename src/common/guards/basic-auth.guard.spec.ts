import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasicAuthGuard } from './basic-auth.guard';

function mockContext(authHeader: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: authHeader },
      }),
    }),
  } as ExecutionContext;
}

function makeBasicHeader(user: string, pass: string): string {
  const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
  return `Basic ${encoded}`;
}

describe('BasicAuthGuard', () => {
  const validUser = 'admin';
  const validPass = 'secret123';
  let guard: BasicAuthGuard;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'app.basicAuthUser') return validUser;
        if (key === 'app.basicAuthPass') return validPass;
        return undefined;
      }),
    } as unknown as ConfigService;

    guard = new BasicAuthGuard(configService);
  });

  it('harus lolos untuk kredensial yang valid', () => {
    const ctx = mockContext(makeBasicHeader(validUser, validPass));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('harus throw UnauthorizedException jika tidak ada header Authorization', () => {
    const ctx = mockContext('');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('harus throw jika header bukan format Basic', () => {
    const ctx = mockContext('Bearer some-token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('harus throw jika username salah', () => {
    const ctx = mockContext(makeBasicHeader('wrong-user', validPass));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('harus throw jika password salah', () => {
    const ctx = mockContext(makeBasicHeader(validUser, 'wrong-pass'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('harus throw jika username dan password keduanya salah', () => {
    const ctx = mockContext(makeBasicHeader('hacker', 'wrong'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('harus throw jika base64 tidak mengandung pemisah titik dua', () => {
    const noColon = Buffer.from('nocolon').toString('base64');
    const ctx = mockContext(`Basic ${noColon}`);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
