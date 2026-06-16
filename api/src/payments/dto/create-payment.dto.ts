import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Length,
} from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsOptional()
  invoiceId?: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  currency: string;

  @IsNumber()
  @IsOptional()
  @Min(0.000001)
  exchangeRate?: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  method: string;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  reference?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @IsNotEmpty()
  paidFromAccountId: number;

  @IsInt()
  @IsNotEmpty()
  categoryAccountId: number;

  @IsInt()
  @IsOptional()
  poId?: number;

  @IsString()
  @IsOptional()
  attachment?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
