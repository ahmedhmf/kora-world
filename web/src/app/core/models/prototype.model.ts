import { Supplier } from './supplier.model';
import { ProductCategory } from './product.model';

export type PrototypeStatus = 'requested' | 'shipped' | 'received' | 'approved' | 'rejected';

export interface Prototype {
  id: number;
  supplierId: number;
  name: string;
  category?: ProductCategory;
  status: PrototypeStatus;
  construction?: Record<string, string>;
  comments?: string;
  createdAt?: string;
  supplier?: Supplier;
}

export interface CreatePrototypeDto {
  supplierId: number;
  name: string;
  category?: ProductCategory;
  status: PrototypeStatus;
  construction?: Record<string, string>;
  comments?: string;
}
