import { Request } from 'express';

export interface ActiveUser {
  sub: number;
  email: string;
  name: string;
  role: string;
  supplierId?: number | null;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: ActiveUser;
}
