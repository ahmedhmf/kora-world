import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.currentUser()?.role === 'admin') {
    return true;
  }

  // Redirect regular employees away from admin-only routes
  router.navigate(['/dashboard']);
  return false;
};
