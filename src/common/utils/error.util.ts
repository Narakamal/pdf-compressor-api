// src/common/utils/error.util.ts

import { HttpException, HttpStatus } from '@nestjs/common';

// ── Types ────────────────────────────────────────────────────────────
export interface ParsedError {
    statusCode: number;
    message: string | string[];
    error?: string;
    stack?: string;
    isHttpException: boolean;
}

// ── Type Guards ──────────────────────────────────────────────────────
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

export function isHttpException(value: unknown): value is HttpException {
    return value instanceof HttpException;
}

// ── Core Utility ─────────────────────────────────────────────────────

/**
 * Parse error apapun → objek terstruktur dengan statusCode & message
 *
 * @example
 * const parsed = getHttpError(error);
 * parsed.statusCode  // 404
 * parsed.message     // "Data tidak ditemukan"
 * parsed.isHttpException // true
 */
export function getHttpError(error: unknown): ParsedError {

    // ── Case 1: NestJS HttpException (NotFoundException, BadRequestException, dll)
    if (isHttpException(error)) {
        const response = error.getResponse();
        const statusCode = error.getStatus();

        // response bisa berupa string atau object
        if (typeof response === 'string') {
            return {
                statusCode,
                message: response,
                isHttpException: true,
                stack: error.stack,
            };
        }

        // response berbentuk object — misal dari ValidationPipe
        const res = response as Record<string, unknown>;
        return {
            statusCode,
            message: (res['message'] as string | string[]) ?? 'Terjadi kesalahan',
            error: res['error'] as string | undefined,
            isHttpException: true,
            stack: error.stack,
        };
    }

    // ── Case 2: Error JS standar (TypeError, ReferenceError, dll)
    if (isError(error)) {
        return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: error.message || 'Internal server error',
            isHttpException: false,
            stack: error.stack,
        };
    }

    // ── Case 3: String dilempar langsung → throw "something went wrong"
    if (typeof error === 'string') {
        return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: error,
            isHttpException: false,
        };
    }

    // ── Case 4: Object unknown (misal dari library eksternal)
    if (typeof error === 'object' && error !== null) {
        const obj = error as Record<string, unknown>;
        return {
            statusCode:
                typeof obj['statusCode'] === 'number'
                    ? obj['statusCode']
                    : HttpStatus.INTERNAL_SERVER_ERROR,
            message:
                typeof obj['message'] === 'string'
                    ? obj['message']
                    : 'Terjadi kesalahan tidak diketahui',
            isHttpException: false,
        };
    }

    // ── Case 5: Fallback — error sama sekali tidak dikenal
    return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Terjadi kesalahan tidak diketahui',
        isHttpException: false,
    };
}

// ── Shorthand helpers (opsional, untuk kemudahan) ────────────────────

export function getErrorMessage(error: unknown): string | string[] {
    return getHttpError(error).message;
}

export function getErrorStatus(error: unknown): number {
    return getHttpError(error).statusCode;
}

export function getErrorStack(error: unknown): string | undefined {
    return getHttpError(error).stack;
}

/**
// Simulasi Semua Case
// Case 1 — NestJS HttpException
getHttpError(new NotFoundException('Pasien tidak ditemukan'))
// → { statusCode: 404, message: "Pasien tidak ditemukan", isHttpException: true }

// Case 2 — ValidationPipe error (array message)
getHttpError(new BadRequestException(['nama wajib diisi', 'email tidak valid']))
// → { statusCode: 400, message: ["nama wajib diisi", "email tidak valid"], isHttpException: true }

// Case 3 — JS Error standar
getHttpError(new TypeError('Cannot read properties of undefined'))
// → { statusCode: 500, message: "Cannot read properties of undefined", isHttpException: false }

// Case 4 — String dilempar
getHttpError('koneksi database timeout')
// → { statusCode: 500, message: "koneksi database timeout", isHttpException: false }

// Case 5 — Unknown object
getHttpError({ statusCode: 503, message: 'Service BPJS tidak tersedia' })
// → { statusCode: 503, message: "Service BPJS tidak tersedia", isHttpException: false }
 */