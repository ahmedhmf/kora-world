import { Supplier } from './supplier.model';
import { ProductCategory } from './product.model';

export type SampleStatus = 'requested' | 'shipped' | 'received' | 'approved' | 'rejected';

export interface Sample {
  id: number;
  supplierId: number;
  name: string;
  category?: ProductCategory;
  status: SampleStatus;
  construction?: Record<string, string>;
  comments?: string;
  techPackPath?: string;
  techPackName?: string;
  carrier?: string;
  trackingNumber?: string;
  createdAt?: string;
  supplier?: Supplier;
  parentSampleId?: number | null;
  roundNumber?: number;
  parentSample?: Sample | null;
  receiptProtocol?: any;
  articleNumber?: string;
  collection?: string;
  year?: number;
  articleCounter?: number;
}

export interface CreateSampleDto {
  supplierId: number;
  name: string;
  category?: ProductCategory;
  status: SampleStatus;
  construction?: Record<string, string>;
  comments?: string;
  techPackPath?: string;
  techPackName?: string;
  carrier?: string;
  trackingNumber?: string;
  parentSampleId?: number | null;
  roundNumber?: number;
  receiptProtocol?: any;
  articleNumber?: string;
  collection?: string;
  year?: number;
  articleCounter?: number;
}
