import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Use Helmet to secure HTTP headers
  app.use(helmet());

  // Use Cookie Parser for reading HttpOnly JWT cookies
  app.use(cookieParser());
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  
  // Configure CORS to restrict allowed origins based on environment
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = isProd
    ? (process.env.CORS_ORIGINS?.split(',') || ['https://kora-world.com'])
    : ['http://localhost:4200', 'http://localhost:8080', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        return allowed === origin || origin.startsWith(allowed);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('CORS Policy Violation: Origin not allowed'));
      }
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
