import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceType, InvoiceStatus } from '../entities/invoice.entity';
import { CreateInvoiceLineDto } from './create-invoice-line.dto';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  number: string;

  @IsEnum(InvoiceType)
  @IsNotEmpty()
  type: InvoiceType;

  @IsInt()
  @IsOptional()
  supplierId?: number;

  @IsString()
  @IsOptional()
  @Length(1, 150)
  customerName?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  currency: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tax?: number;

  @IsInt()
  @IsOptional()
  poId?: number;

  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'An invoice must have at least 1 line' })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}
