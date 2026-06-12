import { Supplier } from './supplier.model';

export type ProductCategory = 'football' | 'handball' | 'lifestyle';

export interface Product {
  id: number;
  supplierId: number;
  articleNumber: string;
  name: string;
  category?: ProductCategory;
  description?: string;
  unitPrice: number;
  currency?: string;
  moq?: number;
  weightKg?: number;
  isActive: boolean;
  createdAt?: string;
  supplier?: Supplier;
}

export interface CreateProductDto {
  supplierId: number;
  articleNumber: string;
  name: string;
  category?: ProductCategory;
  description?: string;
  unitPrice: number;
  currency?: string;
  moq?: number;
  weightKg?: number;
}
