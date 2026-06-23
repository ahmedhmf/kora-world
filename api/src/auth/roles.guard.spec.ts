import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockExecutionContext = (
    reqProps: Partial<AuthenticatedRequest>,
    classMock: unknown = {},
    handlerMock: unknown = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: <T>() => reqProps as unknown as T,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: () => classMock,
      getHandler: () => handlerMock,
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      getType: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true if no roles are required (reflector returns undefined)', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({});

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should return true if no roles are required (reflector returns empty array)', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockExecutionContext({});

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false if roles are required but user is not attached to the request', () => {
      reflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({});

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false if roles are required but user does not have a role property', () => {
      reflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({
        user: {
          sub: 1,
          email: 'test@example.com',
          name: 'Test',
        } as unknown as AuthenticatedRequest['user'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false if user role does not match any required roles', () => {
      reflector.getAllAndOverride.mockReturnValue(['admin', 'manager']);
      const context = createMockExecutionContext({
        user: {
          sub: 1,
          email: 'test@example.com',
          name: 'Test',
          role: 'employee',
        } as unknown as AuthenticatedRequest['user'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return true if user role matches one of the required roles', () => {
      reflector.getAllAndOverride.mockReturnValue(['admin', 'manager']);
      const context = createMockExecutionContext({
        user: {
          sub: 1,
          email: 'test@example.com',
          name: 'Test',
          role: 'manager',
        } as unknown as AuthenticatedRequest['user'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
