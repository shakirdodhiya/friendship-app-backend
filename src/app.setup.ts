import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { ErrorResponseDto } from './common/dto/common.dto';
import { AppConfig } from './config/app-config.service';
import { StorageService } from './modules/storage/storage.service';

export const API_PREFIX = 'api/v1';

function setupSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('Friendship App API')
    .setDescription(
      [
        'REST API for the Friendship mobile app.',
        '',
        '**Authentication** — sign in on the device with Firebase Auth (phone OTP, Google or Apple), then send the',
        'Firebase ID token on every request as `Authorization: Bearer <idToken>`. Call `POST /auth/session` once after',
        'sign-in to create the account and learn whether onboarding is needed. Click **Authorize** above to paste a token.',
        '',
        '**Errors** — every error has the shape `{ statusCode, code, message, details? }`. Branch on `code`, e.g.',
        '`INSUFFICIENT_COINS` (402), `CHAT_CAPACITY_REACHED` / `PRO_REQUIRED` / `ONBOARDING_INCOMPLETE` (403).',
        '',
        '**Realtime** — Socket.IO namespace `/realtime`, connect with `auth: { token: <idToken> }`. Server events:',
        '`message.new`, `chat.read`, `chat.closed`, `chat.typing`, `wallet.updated`, `quickMatch.updated`.',
        'Client event: `typing { chatId }`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' })
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'Admin token', description: 'From `POST /admin/auth/login`' },
      'admin',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, { extraModels: [ErrorResponseDto] });
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    customSiteTitle: 'Friendship App API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
    },
  });
}

/** HTTP-level setup shared by `main.ts` and the e2e tests. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(AppConfig);

  app.enableShutdownHooks();
  // Swagger UI ships inline scripts, so the default CSP would blank the docs page.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const origins = config.get('CORS_ORIGINS');
  app.enableCors({ origin: origins === '*' ? true : origins.split(',').map((o) => o.trim()) });

  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useStaticAssets(app.get(StorageService).root, { prefix: '/uploads/', maxAge: '7d', index: false });

  setupSwagger(app);
}
