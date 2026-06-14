import { Supplier } from './supplier.model';
import { Product } from './product.model';

export type POStatus = 'draft' | 'sent' | 'confirmed' | 'shipped' | 'received' | 'cancelled';

export interface PurchaseOrderLineItem {
  id: number;
  poId: number;
  productId?: number;
  articleNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: Product;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  orderDate: string;
  expectedDelivery?: string;
  status: POStatus;
  notes?: string;
  totalValue: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  lineItems?: PurchaseOrderLineItem[];
  shippingCost?: number;
}

export interface CreatePurchaseOrderLineItemDto {
  productId: number;
  quantity: number;
}

export interface CreatePurchaseOrderDto {
  supplierId: number;
  orderDate: string;
  expectedDelivery?: string;
  status?: POStatus;
  notes?: string;
  lineItems: CreatePurchaseOrderLineItemDto[];
  shippingCost?: number;
}
