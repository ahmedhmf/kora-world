import { B2BAccount } from './account.model';

export type ReceiptStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

export interface ReceiptLineItem {
  id: number;
  receiptId: number;
  productId?: number;
  articleNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
}

export interface Receipt {
  id: number;
  receiptNumber: string;
  accountId: number;
  account?: B2BAccount;
  status: ReceiptStatus;
  issueDate: string;
  dueDate?: string;
  currency: string;
  paymentTerms?: string;
  vatRate: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  lineItems?: ReceiptLineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateReceiptLineItemDto {
  productId?: number;
  articleNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
}

export interface CreateReceiptDto {
  accountId: number;
  issueDate: string;
  dueDate?: string;
  currency?: string;
  paymentTerms?: string;
  vatRate?: number;
  notes?: string;
  lineItems: CreateReceiptLineItemDto[];
}

export interface UpdateReceiptDto {
  status?: ReceiptStatus;
  dueDate?: string;
  paymentTerms?: string;
  notes?: string;
}
