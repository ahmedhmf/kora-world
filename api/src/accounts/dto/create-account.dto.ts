import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';

export enum AccountStatus {
  UNDER_DISCUSSION = 'under_discussion',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum CustomerType {
  RETAILER = 'Retailer',
  DISTRIBUTOR = 'Distributor',
  SPORTS_CLUB = 'Sports Club',
  SCHOOL_ACADEMY = 'School / Academy',
  CORPORATE = 'Corporate',
  OTHER = 'Other',
}

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;

  @IsEnum(CustomerType)
  @IsNotEmpty()
  customerType: CustomerType;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsNotEmpty()
  primaryContactName: string;

  @IsString()
  @IsNotEmpty()
  primaryContactEmail: string;

  @IsString()
  @IsOptional()
  primaryContactPhone?: string;

  @IsString()
  @IsOptional()
  billingStreet?: string;

  @IsString()
  @IsOptional()
  billingCity?: string;

  @IsString()
  @IsOptional()
  billingZip?: string;

  @IsString()
  @IsOptional()
  billingCountry?: string;

  @IsString()
  @IsOptional()
  shippingStreet?: string;

  @IsString()
  @IsOptional()
  shippingCity?: string;

  @IsString()
  @IsOptional()
  shippingZip?: string;

  @IsString()
  @IsOptional()
  shippingCountry?: string;

  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  creditLimit?: number;

  @IsString()
  @IsOptional()
  vatNumber?: string;

  @IsInt()
  @IsOptional()
  assignedSalesRepId?: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}
