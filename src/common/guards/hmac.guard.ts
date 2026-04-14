import {
    CanActivate, ExecutionContext, Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256 Guard
 *
 * Client wajib mengirim header:
 *   X-Timestamp  : unix epoch (ms) — tolak jika >5 menit
 *   X-Signature  : HMAC-SHA256(secret, METHOD\nPATH\nTIMESTAMP\nBODY_SHA256)
 *
 * Mencegah replay attack via timestamp window.
 */
@Injectable()
export class HmacGuard implements CanActivate {
    constructor(private config: ConfigService) { }

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const secret = this.config.get<string>('app.hmacSecret');
        const timestamp = req.headers['x-timestamp'];
        const signature = req.headers['x-signature'];

        if (!timestamp || !signature) throw new UnauthorizedException('Missing HMAC headers');

        if (!secret) throw new UnauthorizedException('HMAC secret not configured');

        // Cegah replay: tolak request lebih dari 5 menit
        const diff = Math.abs(Date.now() - Number(timestamp));
        if (diff > 5 * 60 * 1000) throw new UnauthorizedException('Request expired');

        // Buat payload yang akan di-sign
        const rawBody = req.body && Object.keys(req.body).length
            ? JSON.stringify(req.body)
            : '';

        const bodyHash = createHash('sha256')
            .update(rawBody)
            .digest('hex');

        const payload = [req.method, req.path, timestamp, bodyHash].join('\n');

        const expected = createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        // Timing-safe compare — cegah timing attack
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expected, 'hex');

        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
            throw new UnauthorizedException('Invalid HMAC signature');
        }

        return true;
    }
}