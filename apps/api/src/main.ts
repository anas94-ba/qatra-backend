import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { env } from './config/env';
import { UPLOADS_PREFIX } from './storage/storage.service';
import { SWAGGER_PATH, setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  // whitelist: undeclared fields (e.g. role/status) are silently dropped (TC04)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (!process.env.S3_BUCKET) {
    // Local uploads: random file names never change, so browsers may cache them for a year
    app.useStaticAssets(env.uploadDir, {
      prefix: UPLOADS_PREFIX, index: false, dotfiles: 'deny', maxAge: '365d', immutable: true,
      setHeaders: (res, path) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (path.endsWith('.pdf')) res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    });
  }
  app.enableShutdownHooks();
  const docsEnabled = setupSwagger(app);
  await app.listen(env.port);
  if (docsEnabled) Logger.log(`API docs: ${env.appUrl}/${SWAGGER_PATH}`, 'Bootstrap');
}
bootstrap();
