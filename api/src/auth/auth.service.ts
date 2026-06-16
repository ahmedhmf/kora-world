import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { verifyPassword, signJwt } from './crypto-auth.helper';

@Injectable()
export class AuthService {
  private jwtSecret: string;

  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
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

  async login(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = verifyPassword(pass, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      supplierId: user.supplierId,
    };
    // Token valid for 24 hours (86400 seconds)
    const token = signJwt(payload, this.jwtSecret, 86400);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        supplierId: user.supplierId,
      },
    };
  }

  async changePassword(userId: number, currentPass: string, newPass: string): Promise<void> {
    await this.usersService.updatePassword(userId, currentPass, newPass);
  }
}
