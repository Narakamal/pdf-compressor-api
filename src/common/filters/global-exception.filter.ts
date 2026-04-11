// src/common/filters/global-exception.filter.ts

import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // Menangkap SEMUA jenis exception
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // ── 1. Tentukan HTTP status ──────────────────────────────
        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // ── 2. Ambil pesan error ─────────────────────────────────
        let message: string | object = 'Internal server error';

        if (exception instanceof HttpException) {
            const res = exception.getResponse();
            message = typeof res === 'string' ? res : (res as any).message ?? res;
        }

        // ── 3. Logging (jangan log 4xx terlalu noisy, fokus 5xx) ─
        if (status >= 500) {
            this.logger.error(
                `[${request.method}] ${request.url} → ${status}`,
                exception instanceof Error ? exception.stack : String(exception),
            );
        } else {
            this.logger.warn(
                `[${request.method}] ${request.url} → ${status} | ${JSON.stringify(message)}`,
            );
        }

        // ── 4. Response terstandarisasi ──────────────────────────
        response.status(status).json({
            success: false,
            statusCode: status,
            message,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}