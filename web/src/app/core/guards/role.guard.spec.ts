import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('roleGuard', () => {
  let mockAuthService: { currentUser: ReturnType<typeof signal<{ role: string } | null>> };
  let navigateSpy: ReturnType<typeof vi.fn>;
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function runGuard() {
    return TestBed.runInInjectionContext(() => roleGuard(route, state));
  }

  beforeEach(() => {
    navigateSpy = vi.fn();
    mockAuthService = { currentUser: signal(null) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    });
  });

  it('should allow access when user has admin role', () => {
    mockAuthService.currentUser.set({ role: 'admin' });
    const result = runGuard();
    expect(result).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should deny access and navigate to /dashboard for a non-admin user', () => {
    mockAuthService.currentUser.set({ role: 'employee' });
    const result = runGuard();
    expect(result).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should deny access when no user is logged in', () => {
    mockAuthService.currentUser.set(null);
    const result = runGuard();
    expect(result).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });
});
