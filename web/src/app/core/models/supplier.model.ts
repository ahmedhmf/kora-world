export interface SupplierContact {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  sendInfo: boolean;
  sendPo: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  country: string;
  contacts: SupplierContact[];
  paymentTerms?: string;
  leadTimeDays?: number;
  currency: string;
  notes?: string;
  createdAt?: string;
  shippingRatePerKg?: number;
}

export interface CreateSupplierDto {
  name: string;
  country: string;
  contacts: SupplierContact[];
  paymentTerms?: string;
  leadTimeDays?: number;
  currency: string;
  notes?: string;
  shippingRatePerKg?: number;
}
