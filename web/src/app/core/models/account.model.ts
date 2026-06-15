import { User } from './user.model';

export type AccountStatus = 'under_discussion' | 'active' | 'inactive' | 'suspended';
export type CustomerType = 'Retailer' | 'Distributor' | 'Sports Club' | 'School / Academy' | 'Corporate' | 'Other';

export interface B2BAccount {
  id: number;
  companyName: string;
  accountNumber: string;
  status: AccountStatus;
  customerType: CustomerType;
  website?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingZip?: string;
  billingCountry?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingZip?: string;
  shippingCountry?: string;
  defaultCurrency: string;
  paymentTerms: string;
  creditLimit: number;
  vatNumber?: string;
  assignedSalesRepId?: number;
  assignedSalesRep?: User;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAccountDto {
  companyName: string;
  status?: AccountStatus;
  customerType: CustomerType;
  website?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingZip?: string;
  billingCountry?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingZip?: string;
  shippingCountry?: string;
  defaultCurrency?: string;
  paymentTerms?: string;
  creditLimit?: number;
  vatNumber?: string;
  assignedSalesRepId?: number;
  remarks?: string;
}
