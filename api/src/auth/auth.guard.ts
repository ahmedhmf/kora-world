import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyJwt } from './crypto-auth.helper';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  private jwtSecret: string;

  constructor(private configService: ConfigService) {
    const secret = this.configService.get<string>('JWT_SECRET');
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const defaultSecret = 'kora_super_secret_jwt_key_2026';

    if (isProd && (!secret || secret === defaultSecret)) {
      throw new Error(
        'PRODUCTION SECURITY VIOLATION: JWT_SECRET must be set to a secure custom value in production environments.',
      );
    }

    this.jwtSecret = secret || defaultSecret;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const payload = verifyJwt(token, this.jwtSecret);
    if (!payload) {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    // Attach user payload to request
    request.user = payload;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    // 1. Try to read from cookies first (HttpOnly cookies)
    if (request.cookies && request.cookies['kora_token']) {
      return request.cookies['kora_token'] as string;
    }

    // 2. Fall back to Authorization Bearer header
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
