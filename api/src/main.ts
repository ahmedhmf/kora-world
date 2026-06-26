import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Helmet to secure HTTP headers
  // crossOriginResourcePolicy must be 'cross-origin' so the Angular frontend
  // (on a different port/origin) can load images served by the API.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // managed by the Angular app / nginx
    }),
  );

  // Use Cookie Parser for reading HttpOnly JWT cookies
  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Configure CORS to restrict allowed origins based on environment
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = isProd
    ? process.env.CORS_ORIGINS?.split(',') || ['https://kora-world.com']
    : [
        'http://localhost:4200',
        'http://localhost:8080',
        'http://localhost:3000',
      ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // Always allow in development environment
      if (!isProd) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        return allowed === origin || origin.startsWith(allowed);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error(`CORS Policy Violation: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
