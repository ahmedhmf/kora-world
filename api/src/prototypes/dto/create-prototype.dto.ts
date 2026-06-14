import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEnum,
  IsPositive,
  IsObject,
} from 'class-validator';
import { ProductCategory } from '../../products/entities/product.entity';
import { PrototypeStatus } from '../entities/prototype.entity';

export class CreatePrototypeDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  supplierId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsEnum(PrototypeStatus)
  @IsNotEmpty()
  status: PrototypeStatus;

  @IsObject()
  @IsOptional()
  construction?: Record<string, string>;

  @IsString()
  @IsOptional()
  comments?: string;
}
