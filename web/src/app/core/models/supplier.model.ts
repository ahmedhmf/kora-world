export interface Supplier {
  id: number;
  name: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  currency?: string;
  notes?: string;
  createdAt?: string;
}

export interface CreateSupplierDto {
  name: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  currency?: string;
  notes?: string;
}
