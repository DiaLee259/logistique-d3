import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SpaFilter } from './spa.filter';
import { join } from 'path';
import express from 'express';
import * as fs from 'fs';

async function bootstrap() {
  const distPath = join(__dirname, '..', 'frontend');
  const server = express();

  // Static files servis AVANT les routes NestJS
  if (fs.existsSync(distPath)) {
    server.use(express.static(distPath));
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true,
  });

  // Fallback SPA : toutes les routes non-API servent index.html
  if (fs.existsSync(distPath)) {
    app.useGlobalFilters(new SpaFilter());
  }

  await app.init();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 Backend logistique démarré sur http://localhost:${port}/api\n`);
}
bootstrap();
