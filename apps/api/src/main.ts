import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import { AppModule } from './app.module';
import { env } from './config/env';
import { SWAGGER_PATH, setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  // whitelist: undeclared fields (e.g. role/status) are silently dropped (TC04)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (!process.env.S3_BUCKET) app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/files' });
  app.enableShutdownHooks();
  setupSwagger(app);
  await app.listen(env.port);
  Logger.log(`API docs: http://localhost:${env.port}/${SWAGGER_PATH}`, 'Bootstrap');
}
bootstrap();
