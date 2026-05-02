# PDF Compressor API

NestJS-based asynchronous PDF compression service menggunakan Ghostscript dan BullMQ dengan Redis Cloud.

## Status Proyek

- **Aplikasi**: Berjalan di port 3000
- **Redis**: Redis Cloud (us-east-1) — terhubung
- **Ghostscript**: v10.05.1 — siap
- **Unit Test**: 83 passed / 11 suites — semua hijau

## Arsitektur

- **Framework**: NestJS v11 (TypeScript)
- **Queue**: BullMQ + Redis Cloud (async job processing)
- **Kompresi**: Ghostscript (`gs` binary, dPDFSETTINGS=/ebook)
- **Auth**: Basic Auth (default) atau HMAC-SHA256 (configurable via AUTH_MODE)
- **Port**: 3000

## Struktur Proyek

```
src/
  app.module.ts                    - Root module
  main.ts                          - Entry point (port 3000)
  config/
    app.config.ts                  - Konfigurasi app & auth
  pdf/
    pdf.controller.ts              - REST endpoints (compress, status, progress, download)
    pdf.service.ts                 - Orkestrasi job
    pdf.processor.service.ts       - BullMQ worker (proses antrian)
    ghostscript.service.ts         - Wrapper binary gs
    pdf.storage.service.ts         - Manajemen file temp
    pdf.service.spec.ts            - Unit test PdfService
    pdf.storage.service.spec.ts    - Unit test StorageService
    pdf.processor.service.spec.ts  - Unit test PdfProcessor
    ghostscript.service.spec.ts    - Unit test GhostscriptService
  common/
    guards/
      basic-auth.guard.ts          - Basic Auth guard
      basic-auth.guard.spec.ts     - Unit test
      hmac.guard.ts                - HMAC-SHA256 guard
      hmac.guard.spec.ts           - Unit test
    filters/
      global-exception.filter.ts   - Global error handler
      global-exception.filter.spec.ts - Unit test
    interceptors/
      file-validation.interceptor.ts    - Validasi PDF upload
      file-validation.interceptor.spec.ts - Unit test
    utils/
      file.util.ts                 - Magic bytes, token generator
      file.util.spec.ts            - Unit test
      error.util.ts                - Error parsing utility
      error.util.spec.ts           - Unit test
  scheduler/
    cleanup.scheduler.ts           - Cron purge file expired (tiap 5 menit)
    cleanup.scheduler.spec.ts      - Unit test
```

## API Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/pdf/compress` | Upload PDF untuk kompresi (max 50MB) |
| GET | `/pdf/job/:id/status` | Poll status job |
| GET | `/pdf/job/:id/progress` | SSE progress real-time |
| GET | `/pdf/job/:id/download?token=...` | Download hasil kompresi |

## Environment Variables

| Variable | Env | Keterangan |
|---|---|---|
| `REDIS_HOST` | shared | Host Redis Cloud |
| `REDIS_PORT` | shared | Port Redis Cloud (18680) |
| `AUTH_MODE` | shared | `basic` atau `hmac` |
| `TEMP_DIR` | shared | Dir temp file (`/tmp/pdf-jobs`) |
| `REDIS_PASSWORD` | secret | Password Redis Cloud |
| `BASIC_AUTH_USER` | secret | Username Basic Auth |
| `BASIC_AUTH_PASS` | secret | Password Basic Auth |
| `DOWNLOAD_TOKEN_SECRET` | secret | HMAC secret untuk download token |
| `HMAC_SECRET` | secret | Secret untuk HMAC guard |

## Menjalankan Lokal

```bash
bash start.sh   # Start Redis daemon + NestJS (watch mode)
npm test        # Jalankan semua unit test
npm test -- --coverage  # Test + coverage report
```

## Coverage Test (83 tests, 11 suites)

| Layer | Coverage |
|---|---|
| GlobalExceptionFilter | 100% |
| BasicAuthGuard | 100% |
| HmacGuard | 96% |
| FileValidationInterceptor | 100% |
| file.util | 100% |
| error.util | 93% |
| PdfService | 98% |
| PdfProcessor | 94% |
| StorageService | 94% |
| CleanupScheduler | 100% |

## Deployment

- Target: `vm` (perlu Redis & Ghostscript yang terus berjalan)
- Build: `npm run build`
- Run: `bash start.sh`

## Fixes Applied

- `tsconfig.json`: `"Multer"` → `"multer"` (case-sensitive type definition)
- `jest.config.ts`: uuid moduleNameMapper path disesuaikan dengan versi yang terinstall
