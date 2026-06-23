import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEmail,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContactPhoneDto {
  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  label: string;
}

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsOptional()
  supplierId?: number;

  @IsNumber()
  @IsOptional()
  accountId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ContactPhoneDto)
  phones?: ContactPhoneDto[];

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  facebook?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
