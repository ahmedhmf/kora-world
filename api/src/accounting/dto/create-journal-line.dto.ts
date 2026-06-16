import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateJournalLineDto {
  @IsInt()
  @IsNotEmpty()
  accountId: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  debit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  credit?: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 10)
  currency: string;

  @IsNumber()
  @IsOptional()
  @Min(0.000001)
  exchangeRate?: number;
}
