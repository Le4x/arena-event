import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get('NODE_ENV') || 'development';

  // Configure CORS properly for development and production
  if (nodeEnv === 'production') {
    // Production: Use whitelist from environment variable
    const allowedOrigins = configService.get('ALLOWED_ORIGINS')?.split(',').filter(Boolean) || [];
    if (allowedOrigins.length === 0) {
      console.warn('⚠️  WARNING: No ALLOWED_ORIGINS set in production! API will reject all CORS requests.');
    }
    app.enableCors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: true,
    });
    console.log('🔒 CORS enabled for:', allowedOrigins);
  } else {
    // Development: Allow localhost on any port
    app.enableCors({
      origin: [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
      ],
      credentials: true,
    });
    console.log('🔓 CORS enabled for all localhost ports (development mode)');
  }

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
    📚 Environment: ${nodeEnv}
  `);
}

bootstrap();
