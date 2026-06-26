import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let mockAuthService: { isAuthenticated: ReturnType<typeof signal<boolean>> };
  let navigateSpy: ReturnType<typeof vi.fn>;
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function runGuard() {
    return TestBed.runInInjectionContext(() => authGuard(route, state));
  }

  beforeEach(() => {
    navigateSpy = vi.fn();
    mockAuthService = { isAuthenticated: signal(false) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    });
  });

  it('should allow access when user is authenticated', () => {
    mockAuthService.isAuthenticated.set(true);
    const result = runGuard();
    expect(result).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should deny access and navigate to /login when not authenticated', () => {
    mockAuthService.isAuthenticated.set(false);
    const result = runGuard();
    expect(result).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
