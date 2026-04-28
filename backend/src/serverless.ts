import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';

const expressApp = express();
let bootstrapped = false;

async function bootstrap() {
  if (!bootstrapped) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { logger: ['error', 'warn'] }
    );
    app.setGlobalPrefix('api');
    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
    await app.init();
    bootstrapped = true;
  }
  return expressApp;
}

export default async function handler(req: any, res: any) {
  await bootstrap();
  expressApp(req, res);
}
