// src/common/filters/global-exception.filter.ts

import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getHttpError } from '../utils/error.util';

@Catch() // Menangkap SEMUA jenis exception
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // ✅ Satu baris — semua info sudah tersedia
        const { statusCode, message, stack } = getHttpError(exception);

        if (statusCode >= 500) {
            this.logger.error(`[${request.method}] ${request.url}`, stack);
        } else {
            this.logger.warn(`[${request.method}] ${request.url} → ${statusCode}`);
        }

        // ── Response terstandarisasi ──────────────────────────
        response.status(statusCode).json({
            success: false,
            statusCode,
            message,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}