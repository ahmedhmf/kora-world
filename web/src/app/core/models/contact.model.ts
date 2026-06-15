export type ContactType = 'marketing' | 'legal' | 'finance' | 'supplier' | 'account' | 'driver' | 'warehouse';

export interface ContactPhone {
  number: string;
  label: string;
}

export interface Contact {
  id: number;
  name: string;
  company?: string;
  position?: string;
  type: ContactType;
  supplierId?: number;
  supplier?: { id: number; name: string };
  accountId?: number;
  account?: { id: number; companyName: string };
  phones?: ContactPhone[];
  email?: string;
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactDto {
  name: string;
  company?: string;
  position?: string;
  type: ContactType;
  supplierId?: number;
  accountId?: number;
  phones?: ContactPhone[];
  email?: string;
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  address?: string;
}

export interface UpdateContactDto extends Partial<CreateContactDto> {}
