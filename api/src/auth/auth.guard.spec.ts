import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from './auth.guard';
import { verifyJwt } from './crypto-auth.helper';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

jest.mock('./crypto-auth.helper', () => ({
  verifyJwt: jest.fn(),
}));

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const mockActiveUser = {
    sub: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    supplierId: null,
  };

  const createMockExecutionContext = (reqProps: Partial<AuthenticatedRequest>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: <T>() => reqProps as unknown as T,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      getType: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'custom_jwt_secret';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('Constructor Security Checks', () => {
    it('should throw an Error in production if JWT_SECRET is not set', () => {
      configService.get?.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      });

      expect(() => new AuthGuard(configService as ConfigService)).toThrow(
        'PRODUCTION SECURITY VIOLATION',
      );
    });

    it('should throw an Error in production if JWT_SECRET matches default secret', () => {
      configService.get?.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'kora_super_secret_jwt_key_2026';
        return undefined;
      });

      expect(() => new AuthGuard(configService as ConfigService)).toThrow(
        'PRODUCTION SECURITY VIOLATION',
      );
    });

    it('should not throw in production if JWT_SECRET is custom and secure', () => {
      configService.get?.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'secure_production_only_secret_12345';
        return undefined;
      });

      expect(() => new AuthGuard(configService as ConfigService)).not.toThrow();
    });
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException if no token is provided in cookies or headers', () => {
      const context = createMockExecutionContext({
        cookies: {},
        headers: {},
      } as unknown as AuthenticatedRequest);

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Missing authentication token'),
      );
    });

    it('should throw UnauthorizedException if token type is not Bearer in authorization header', () => {
      const context = createMockExecutionContext({
        cookies: {},
        headers: {
          authorization: 'Basic dGVzdDp0ZXN0',
        },
      } as unknown as AuthenticatedRequest);

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Missing authentication token'),
      );
    });

    it('should extract token from kora_token cookie and throw if verification fails', () => {
      const context = createMockExecutionContext({
        cookies: {
          kora_token: 'invalid-cookie-token',
        },
        headers: {},
      } as unknown as AuthenticatedRequest);

      (verifyJwt as jest.Mock).mockReturnValue(null);

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Invalid or expired authentication token'),
      );
      expect(verifyJwt).toHaveBeenCalledWith('invalid-cookie-token', 'custom_jwt_secret');
    });

    it('should extract token from Authorization header and throw if verification fails', () => {
      const context = createMockExecutionContext({
        cookies: {},
        headers: {
          authorization: 'Bearer invalid-header-token',
        },
      } as unknown as AuthenticatedRequest);

      (verifyJwt as jest.Mock).mockReturnValue(null);

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Invalid or expired authentication token'),
      );
      expect(verifyJwt).toHaveBeenCalledWith('invalid-header-token', 'custom_jwt_secret');
    });

    it('should attach user payload to request and return true for valid cookie token', () => {
      const requestMock = {
        cookies: {
          kora_token: 'valid-cookie-token',
        },
        headers: {},
        user: undefined,
      } as unknown as AuthenticatedRequest;

      const context = createMockExecutionContext(requestMock);
      (verifyJwt as jest.Mock).mockReturnValue(mockActiveUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(requestMock.user).toEqual(mockActiveUser);
      expect(verifyJwt).toHaveBeenCalledWith('valid-cookie-token', 'custom_jwt_secret');
    });

    it('should attach user payload to request and return true for valid header token', () => {
      const requestMock = {
        cookies: {},
        headers: {
          authorization: 'Bearer valid-header-token',
        },
        user: undefined,
      } as unknown as AuthenticatedRequest;

      const context = createMockExecutionContext(requestMock);
      (verifyJwt as jest.Mock).mockReturnValue(mockActiveUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(requestMock.user).toEqual(mockActiveUser);
      expect(verifyJwt).toHaveBeenCalledWith('valid-header-token', 'custom_jwt_secret');
    });
  });
});
