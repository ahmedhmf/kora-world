import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReceiptStatus } from '../entities/receipt.entity';

export class UpdateReceiptDto {
  @IsOptional()
  @IsEnum(ReceiptStatus)
  status?: ReceiptStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
