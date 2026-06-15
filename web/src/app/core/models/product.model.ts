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
  construction?: Record<string, string>;
  techPackPath?: string;
  techPackName?: string;
  imagePath?: string;
  imageName?: string;
  collection?: string;
  year?: number;
  articleCounter?: number;
  pricepoint?: string;
}

export interface CreateProductDto {
  supplierId: number;
  articleNumber?: string;
  name: string;
  category?: ProductCategory;
  description?: string;
  unitPrice: number;
  currency?: string;
  moq?: number;
  weightKg?: number;
  construction?: Record<string, string>;
  techPackPath?: string;
  techPackName?: string;
  imagePath?: string;
  imageName?: string;
  collection?: string;
  year?: number;
  articleCounter?: number;
  pricepoint?: string;
}
