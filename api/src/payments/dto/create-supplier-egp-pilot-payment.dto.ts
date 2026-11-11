import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateSupplierEgpPilotPaymentDto {
  @IsInt()
  @Min(1)
  invoiceId: number;

  @IsInt()
  @Min(1)
  bankAccountId: number;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsDateString()
  date: string;

  @IsUUID()
  requestKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
