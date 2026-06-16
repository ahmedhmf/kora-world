import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  Length,
} from 'class-validator';
import { AccountType } from '../entities/accounting-account.entity';

export class CreateAccountingAccountDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;

  @IsEnum(AccountType, {
    message: 'Type must be one of asset, liability, equity, revenue, expense',
  })
  type: AccountType;

  @IsString()
  @IsOptional()
  @Length(1, 10)
  currency?: string;

  @IsInt()
  @IsOptional()
  parentId?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
