import { IsString, IsNotEmpty, IsOptional, IsInt, IsEmail, Min, IsIn, IsNumber } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  leadTimeDays?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['USD', 'EUR', 'EGP'])
  currency: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingRatePerKg?: number;
}
