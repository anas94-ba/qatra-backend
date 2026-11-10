import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createDocsAuth, docsCredentials, MIN_PRODUCTION_PASSWORD_LENGTH } from './swagger-auth';

export const SWAGGER_PATH = 'api/docs';

/**
 * Interactive API docs, protected with HTTP Basic auth (SWAGGER_USER / SWAGGER_PASSWORD).
 *  - SWAGGER_ENABLED=false turns the docs off completely.
 *  - Production without credentials (or with a short password) keeps the docs OFF.
 *  - Outside production without credentials the docs stay open (local development only).
 * Returns true when the docs are mounted.
 */
export function setupSwagger(app: INestApplication): boolean {
  const logger = new Logger('Swagger');
  const isProduction = process.env.NODE_ENV === 'production';
  if (process.env.SWAGGER_ENABLED === 'false') return false;

  const credentials = docsCredentials(process.env);
  if (!credentials) {
    if (isProduction) {
      logger.warn('API docs are disabled: set SWAGGER_USER and SWAGGER_PASSWORD to expose /api/docs in production');
      return false;
    }
    logger.warn('API docs are open because SWAGGER_USER/SWAGGER_PASSWORD are not set (development only)');
  } else {
    if (isProduction && credentials.password.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
      logger.warn(`API docs are disabled: SWAGGER_PASSWORD must be at least ${MIN_PRODUCTION_PASSWORD_LENGTH} characters in production`);
      return false;
    }
    // Must be registered before SwaggerModule.setup so it also guards the JSON/YAML exports and UI assets
    app.use(createDocsAuth(credentials));
  }

  const config = new DocumentBuilder()
    .setTitle('Qatra API')
    .setDescription('Coordination of filtered drinking-water distribution to Gaza camps. List endpoints accept ?page=1&pageSize=10 (default 10, max 100).')
    .setVersion('0.8.1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, config), {
    swaggerOptions: { persistAuthorization: true },
  });
  return true;
}
