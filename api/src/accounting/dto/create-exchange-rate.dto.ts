import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  Length,
} from 'class-validator';

export class CreateExchangeRateDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 10)
  fromCurrency: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 10)
  toCurrency: string;

  @IsNumber()
  @IsNotEmpty()
  rate: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;
}
