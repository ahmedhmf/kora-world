import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  // Stub localStorage using vitest
  const localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => localStorageMock[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => { localStorageMock[key] = value; });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => { delete localStorageMock[key]; });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);

    // Flush the /auth/me call made in the constructor
    const meReq = httpTesting.expectOne((req) => req.url.includes('/auth/me'));
    meReq.flush({ user: null });
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── isAuthenticated computed ─────────────────────────────────────────────

  describe('isAuthenticated', () => {
    it('should be false when currentUser is null', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should be true when currentUser is set', () => {
      service.currentUser.set({ id: 1, email: 'a@b.com', role: 'admin' });
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  // ─── loadUserFromServer (constructor) ─────────────────────────────────────

  describe('loadUserFromServer', () => {
    it('should update currentUser when /auth/me returns a user', (() => {
      const user = { id: 2, email: 'server@test.com', role: 'admin' };

      TestBed.resetTestingModule();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
        ],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      freshHttp.expectOne((req) => req.url.includes('/auth/me')).flush({ user });
      expect(freshService.currentUser()).toEqual(user);
      freshHttp.verify();
    }));

    it('should clear session when /auth/me returns error', (() => {
      TestBed.resetTestingModule();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
        ],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      freshHttp.expectOne((req) => req.url.includes('/auth/me')).error(new ErrorEvent('network error'));
      expect(freshService.currentUser()).toBeNull();
      freshHttp.verify();
    }));

    it('should load user from localStorage hint on init', (() => {
      const user = { id: 1, email: 'cached@test.com', role: 'employee' };

      TestBed.resetTestingModule();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(user));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
        ],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      // User should be loaded immediately from localStorage
      expect(freshService.currentUser()).toEqual(user);

      freshHttp.expectOne((req) => req.url.includes('/auth/me')).flush({ user });      freshHttp.verify();
    }));

    it('should handle malformed JSON in localStorage gracefully', (() => {
      TestBed.resetTestingModule();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('NOT_VALID_JSON');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
        ],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      expect(freshService.currentUser()).toBeNull();

      freshHttp.expectOne((req) => req.url.includes('/auth/me')).flush({ user: null });      freshHttp.verify();
    }));
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should POST credentials and update currentUser on success', (() => {
      const user = { id: 1, email: 'admin@kora.com', role: 'admin' };
      service.login({ email: 'admin@kora.com', password: 'pass' }).subscribe();

      const req = httpTesting.expectOne((r) => r.url.includes('/auth/login'));
      expect(req.request.method).toBe('POST');
      req.flush({ user });
      expect(service.currentUser()).toEqual(user);
      expect(localStorage.setItem).toHaveBeenCalledWith('kora_user', JSON.stringify(user));
    }));

    it('should not update currentUser if response has no user property', (() => {
      service.login({ email: 'x@x.com', password: 'bad' }).subscribe();
      httpTesting.expectOne((r) => r.url.includes('/auth/login')).flush({});      expect(service.currentUser()).toBeNull();
    }));
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should POST /auth/logout and clear session on success', (() => {
      service.currentUser.set({ id: 1, email: 'a@b.com' });
      service.logout();

      const req = httpTesting.expectOne((r) => r.url.includes('/auth/logout'));
      expect(req.request.method).toBe('POST');
      req.flush({});
      expect(service.currentUser()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('kora_user');
    }));

    it('should clear session even if logout POST fails', (() => {
      service.currentUser.set({ id: 1, email: 'a@b.com' });
      service.logout();

      httpTesting.expectOne((r) => r.url.includes('/auth/logout')).error(new ErrorEvent('network'));
      expect(service.currentUser()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('kora_user');
    }));
  });

  // ─── changePassword ───────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should POST to /auth/change-password with correct body', (() => {
      let result: unknown;
      service.changePassword('old123', 'new456').subscribe((res) => (result = res));

      const req = httpTesting.expectOne((r) => r.url.includes('/auth/change-password'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ currentPassword: 'old123', newPassword: 'new456' });
      req.flush({ success: true });
      expect(result).toEqual({ success: true });
    }));
  });
});
