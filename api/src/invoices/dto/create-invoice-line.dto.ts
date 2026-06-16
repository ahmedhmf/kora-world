import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateInvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  unitPrice: number;
}
