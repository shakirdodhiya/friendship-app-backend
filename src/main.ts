import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './app.setup';
import { AppConfig } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);

  const port = app.get(AppConfig).get('PORT');
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API     http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Swagger http://localhost:${port}/docs`);
}

void bootstrap();
