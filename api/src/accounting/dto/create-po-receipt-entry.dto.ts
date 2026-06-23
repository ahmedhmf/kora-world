import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Length,
} from 'class-validator';

export class CreatePOReceiptEntryDto {
  @IsInt()
  @IsNotEmpty()
  poId: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 10)
  currency: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.000001)
  exchangeRate: number;
}
