import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS')?.split(',') || '*',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  console.log(`
    🚀 Arena Event API is running!
    📡 HTTP: http://localhost:${port}
    🔌 WebSocket: ws://localhost:${port}
    📚 Environment: ${configService.get('NODE_ENV')}
  `);
}

bootstrap();
