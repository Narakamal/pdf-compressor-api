# PDF Compressor API

A NestJS-based asynchronous PDF compression service powered by Ghostscript and BullMQ.

## Architecture

- **Framework:** NestJS v11 (TypeScript)
- **Queue:** BullMQ backed by Redis (for async job processing)
- **Compression:** Ghostscript (`gs` binary)
- **Port:** 3000

## Project Structure

```
src/
  app.module.ts          - Root module
  main.ts                - Entry point (listens on port 3000)
  config/
    app.config.ts        - App + auth configuration
    redis.config.ts      - Redis configuration
  pdf/
    pdf.controller.ts    - REST endpoints
    pdf.service.ts       - Job orchestration
    pdf.processor.service.ts - BullMQ worker
    ghostscript.service.ts   - GS binary wrapper
    pdf.storage.service.ts   - Temp file management
    dto/                 - Request/response DTOs
    entities/            - Domain entities
  common/
    guards/              - Auth guards (HMAC, Basic Auth)
    filters/             - Global exception filter
    interceptors/        - File validation
    utils/               - Error & file helpers
  scheduler/             - Cleanup cron jobs
```

## API Endpoints

- `POST /pdf/compress` — Upload a PDF for compression
- `GET /pdf/job/:id/status` — Poll job status
- `GET /pdf/job/:id/progress` — Get progress percentage
- `GET /pdf/job/:id/download` — Download compressed PDF

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BASIC_AUTH_USER` | Basic auth username | — |
| `BASIC_AUTH_PASS` | Basic auth password | — |
| `HMAC_SECRET` | HMAC signing secret | — |
| `AUTH_MODE` | `basic` or `hmac` | `basic` |
| `DOWNLOAD_TOKEN_SECRET` | Token for download URLs | — |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `""` |
| `TEMP_DIR` | Temp storage dir | `/tmp/pdf-jobs` |

## System Dependencies

- **Redis** — Queue backing store (started via `redis-server --daemonize yes`)
- **Ghostscript** — PDF compression binary (`gs`)

## Running

```bash
bash start.sh   # Starts Redis daemon then NestJS in watch mode
```

## Key Fixes Applied

- `tsconfig.json`: Changed `"Multer"` to `"multer"` in the `types` array (case-sensitive type definition)
