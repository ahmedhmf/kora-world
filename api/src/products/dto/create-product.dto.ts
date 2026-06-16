import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
  IsPositive,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory } from '../entities/product.entity';

export class CreateProductDto {
  @IsInt()
  @IsPositive()
  supplierId: number;

  @IsString()
  @IsNotEmpty()
  articleNumber: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  unitPrice: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  moq?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weightKg?: number;

  @IsObject()
  @IsOptional()
  construction?: Record<string, string>;

  @IsString()
  @IsOptional()
  techPackPath?: string;

  @IsString()
  @IsOptional()
  techPackName?: string;

  @IsString()
  @IsOptional()
  imagePath?: string;

  @IsString()
  @IsOptional()
  imageName?: string;

  @IsString()
  @IsOptional()
  collection?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  year?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  articleCounter?: number;

  @IsString()
  @IsOptional()
  pricepoint?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  landingPrice?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  onePcPrice?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  bulkPrice?: number;
}
