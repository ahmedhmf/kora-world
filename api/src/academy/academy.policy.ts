import { ForbiddenException, BadRequestException } from '@nestjs/common';

export function requireAcademyRole(role: string, adminOnly = false): void {
  if (role !== 'admin' && (adminOnly || role !== 'employee')) {
    throw new ForbiddenException('Academy access denied');
  }
}

export function validateAcademyRoute(route: string): string {
  // Only known static application routes are allowed in this first slice.
  const allowed = ['/suppliers','/products','/purchase-orders','/purchase-orders/new',
    '/accounts','/warehouse','/warehouse/equipment','/calendar','/experiences','/accounting/simple'];
  if (!allowed.includes(route)) throw new BadRequestException('Unsupported Academy route');
  return route;
}
