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
    this.loadUserFromToken();
  }

  private get base(): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '/api';
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/login`, credentials).pipe(
      tap((res) => {
        if (res && res.token) {
          localStorage.setItem('kora_token', res.token);
          this.currentUser.set(res.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('kora_token');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private loadUserFromToken(): void {
    const token = localStorage.getItem('kora_token');
    if (!token) return;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.clearSession();
        return;
      }

      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp > now) {
        this.currentUser.set({
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
        });
      } else {
        this.clearSession();
      }
    } catch {
      this.clearSession();
    }
  }

  private clearSession(): void {
    localStorage.removeItem('kora_token');
    this.currentUser.set(null);
  }
}
