// src/common/guards/hmac.guard.spec.ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HmacGuard } from './hmac.guard';
import * as crypto from 'crypto';

// Helper: buat signature yang valid untuk test
function makeValidHeaders(secret: string, method = 'POST', path = '/pdf/compress') {
    const timestamp = Date.now().toString();
    const bodyHash = crypto.createHash('sha256').update('').digest('hex');
    const payload = [method, path, timestamp, bodyHash].join('\n');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return { timestamp, signature };
}

// Helper: buat mock ExecutionContext dari NestJS
function mockContext(headers: Record<string, string>, method = 'POST', path = '/pdf/compress') {
    return {
        switchToHttp: () => ({
            getRequest: () => ({ headers, method, path, body: {} }),
        }),
    } as ExecutionContext;
}

describe('HmacGuard', () => {
    const secret = 'test-hmac-secret-32-karakter-xxx';
    let guard: HmacGuard;

    beforeEach(() => {
        const configService = { get: () => secret } as unknown as ConfigService;
        guard = new HmacGuard(configService);
    });

    it('harus lolos untuk signature yang valid', () => {
        const { timestamp, signature } = makeValidHeaders(secret);
        const ctx = mockContext({ 'x-timestamp': timestamp, 'x-signature': signature });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('harus throw jika header tidak ada', () => {
        const ctx = mockContext({});
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('harus throw jika signature salah', () => {
        const { timestamp } = makeValidHeaders(secret);
        const ctx = mockContext({
            'x-timestamp': timestamp,
            'x-signature': 'a'.repeat(64), // signature palsu
        });
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('harus throw jika timestamp lebih dari 5 menit yang lalu', () => {
        const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 menit lalu
        const bodyHash = crypto.createHash('sha256').update('').digest('hex');
        const payload = ['POST', '/pdf/compress', oldTimestamp, bodyHash].join('\n');
        const oldSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        const ctx = mockContext({
            'x-timestamp': oldTimestamp,
            'x-signature': oldSignature,
        });
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('harus throw jika timestamp dari masa depan (lebih 5 menit)', () => {
        const futureTimestamp = (Date.now() + 6 * 60 * 1000).toString();
        const bodyHash = crypto.createHash('sha256').update('').digest('hex');
        const payload = ['POST', '/pdf/compress', futureTimestamp, bodyHash].join('\n');
        const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        const ctx = mockContext({ 'x-timestamp': futureTimestamp, 'x-signature': sig });
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
});