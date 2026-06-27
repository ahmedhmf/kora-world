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
  landingPrice?: number;
  onePcPrice?: number;
  bulkPrice?: number;
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
  graphicLogoPath?: string;
  graphicLogoName?: string;
  graphicPatternPath?: string;
  graphicPatternName?: string;
  size?: string | null;
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
  landingPrice?: number;
  onePcPrice?: number;
  bulkPrice?: number;
  currency?: string;
  moq?: number;
  weightKg?: number;
  construction?: Record<string, string>;
  techPackPath?: string;
  techPackName?: string;
  imagePath?: string;
  imageName?: string;
  graphicLogoPath?: string;
  graphicLogoName?: string;
  graphicPatternPath?: string | null;
  graphicPatternName?: string | null;
  size?: string | null;
  collection?: string;
  year?: number;
  articleCounter?: number;
  pricepoint?: string;
}
