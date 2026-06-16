import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Live signals for authentication state
  readonly currentUser = signal<any | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    this.loadUserFromServer();
  }

  private get base(): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '/api';
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/login`, credentials).pipe(
      tap((res) => {
        if (res && res.user) {
          localStorage.setItem('kora_user', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        }
      })
    );
  }

  logout(): void {
    this.http.post(`${this.base}/auth/logout`, {}).subscribe({
      next: () => {
        localStorage.removeItem('kora_user');
        this.currentUser.set(null);
        this.router.navigate(['/login']);
      },
      error: () => {
        localStorage.removeItem('kora_user');
        this.currentUser.set(null);
        this.router.navigate(['/login']);
      }
    });
  }

  private loadUserFromServer(): void {
    // Load synchronous profile hint from localStorage to keep routing guards happy
    const savedUser = localStorage.getItem('kora_user');
    if (savedUser) {
      try {
        this.currentUser.set(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('kora_user');
      }
    }

    // Verify session state asynchronously with the server
    this.http.get<any>(`${this.base}/auth/me`).subscribe({
      next: (res) => {
        if (res && res.user) {
          localStorage.setItem('kora_user', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        } else {
          this.clearSession();
        }
      },
      error: () => {
        this.clearSession();
      }
    });
  }

  private clearSession(): void {
    localStorage.removeItem('kora_user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }
}
