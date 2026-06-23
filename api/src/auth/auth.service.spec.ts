import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { hashPassword, verifyJwt } from './crypto-auth.helper';
import { User } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: hashPassword('Password123!'),
    name: 'Test User',
    role: 'employee',
    supplierId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      updatePassword: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'custom_jwt_secret_value';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor security violation checks', () => {
    it('should throw Error in production if JWT_SECRET is not set', async () => {
      configService.get?.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      });

      expect(() => {
        new AuthService(usersService as UsersService, configService as ConfigService);
      }).toThrow('PRODUCTION SECURITY VIOLATION');
    });

    it('should throw Error in production if JWT_SECRET is defaultSecret', async () => {
      configService.get?.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'kora_super_secret_jwt_key_2026';
        return undefined;
      });

      expect(() => {
        new AuthService(usersService as UsersService, configService as ConfigService);
      }).toThrow('PRODUCTION SECURITY VIOLATION');
    });

    it('should not throw in production if JWT_SECRET is custom and secure', () => {
      configService.get?.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'my_secure_custom_production_secret';
        return undefined;
      });

      expect(() => {
        new AuthService(usersService as UsersService, configService as ConfigService);
      }).not.toThrow();
    });
  });

  describe('login', () => {
    it('should return token and user when credentials are correct', async () => {
      usersService.findByEmail?.mockResolvedValue(mockUser);

      const result = await service.login('test@example.com', 'Password123!');

      expect(result).toBeDefined();
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        supplierId: mockUser.supplierId,
      });

      // Verify signature and claims of signed token using actual verifyJwt helper
      const decodedPayload = verifyJwt(result.token, 'custom_jwt_secret_value');
      expect(decodedPayload).not.toBeNull();
      expect(decodedPayload?.sub).toBe(mockUser.id);
      expect(decodedPayload?.email).toBe(mockUser.email);
      expect(decodedPayload?.role).toBe(mockUser.role);
    });

    it('should throw UnauthorizedException if user email does not exist', async () => {
      usersService.findByEmail?.mockResolvedValue(null);

      await expect(service.login('nonexistent@example.com', 'Password123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user password is not set', async () => {
      const userWithoutPassword = { ...mockUser };
      delete userWithoutPassword.password;
      usersService.findByEmail?.mockResolvedValue(userWithoutPassword);

      await expect(service.login('test@example.com', 'Password123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      usersService.findByEmail?.mockResolvedValue(mockUser);

      await expect(service.login('test@example.com', 'wrong_password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('should call usersService.updatePassword', async () => {
      usersService.updatePassword?.mockResolvedValue(undefined);

      await service.changePassword(1, 'oldPassword', 'newPassword');

      expect(usersService.updatePassword).toHaveBeenCalledWith(1, 'oldPassword', 'newPassword');
    });
  });
});
