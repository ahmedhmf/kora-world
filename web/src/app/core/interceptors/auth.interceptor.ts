import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Enforce credentials (cookies) to be sent automatically with every HTTP request
  const cloned = req.clone({
    withCredentials: true,
  });

  return next(cloned);
};
