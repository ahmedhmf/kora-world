import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEmail,
  Min,
  IsIn,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SupplierContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsBoolean()
  @IsOptional()
  sendInfo?: boolean;

  @IsBoolean()
  @IsOptional()
  sendPo?: boolean;
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierContactDto)
  contacts: SupplierContactDto[];

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
