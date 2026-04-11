import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Batas ukuran body — pertahanan pertama sebelum Multer
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (contentLength > 50 * 1024 * 1024) {
      return res.status(413).json({ message: 'Payload too large' });
    }
    next();
  });

  await app.listen(3000);
}
bootstrap();