import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

/** Interactive API docs. Enabled outside production, or when SWAGGER_ENABLED=true. */
export function setupSwagger(app: INestApplication): void {
  const enabled = process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  if (!enabled) return;

  const config = new DocumentBuilder()
    .setTitle('Qatra API')
    .setDescription('Coordination of filtered drinking-water distribution to Gaza camps. List endpoints accept ?page=1&pageSize=10 (default 10, max 100).')
    .setVersion('0.5.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, config), {
    swaggerOptions: { persistAuthorization: true },
  });
}
