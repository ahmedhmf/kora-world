import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyJwt } from './crypto-auth.helper';

@Injectable()
export class AuthGuard implements CanActivate {
  private jwtSecret: string;

  constructor(private configService: ConfigService) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'kora_super_secret_jwt_key_2026';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
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
    request['user'] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
