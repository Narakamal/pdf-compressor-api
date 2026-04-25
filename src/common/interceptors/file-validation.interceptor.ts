import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    BadRequestException,
    PayloadTooLargeException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { isPdfByMagicBytes, hasBombSignature } from '../utils/file.util';

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
    constructor(private config: ConfigService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const file: Express.Multer.File | undefined = req.file;

        // ── 1. Pastikan file ada ──────────────────────────────────
        if (!file) {
            throw new BadRequestException('File PDF wajib dilampirkan');
        }

        const minBytes = this.config.get<number>('app.file.minBytes') || 10 * 1024;
        const maxBytes = this.config.get<number>('app.file.maxBytes') || 50 * 1024 * 1024;

        // ── 2. Cek ukuran minimum ─────────────────────────────────
        if (file.size < minBytes) {
            throw new BadRequestException(
                `Ukuran file terlalu kecil. Minimum ${minBytes / 1024} KB`,
            );
        }

        // ── 3. Cek ukuran maksimum ────────────────────────────────
        if (file.size > maxBytes) {
            throw new PayloadTooLargeException(
                `Ukuran file melebihi batas. Maksimum ${maxBytes / (1024 * 1024)} MB`,
            );
        }

        // ── 4. Validasi magic bytes — jangan percaya MIME dari client
        if (!isPdfByMagicBytes(file.buffer)) {
            throw new UnprocessableEntityException(
                'File bukan PDF valid (magic bytes tidak cocok)',
            );
        }

        // ── 5. Deteksi PDF bomb ───────────────────────────────────
        if (hasBombSignature(file.buffer)) {
            throw new UnprocessableEntityException(
                'File terdeteksi sebagai PDF berbahaya (terlalu banyak object stream)',
            );
        }

        return next.handle();
    }
}