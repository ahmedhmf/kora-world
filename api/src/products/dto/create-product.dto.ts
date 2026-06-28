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
  IsArray,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory } from '../entities/product.entity';

export class CreateProductDto {
  @IsInt()
  @IsPositive()
  supplierId: number;

  @IsString()
  @IsOptional()
  articleNumber?: string;

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
  @ValidateIf((o, v) => v !== null)
  techPackPath?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  techPackName?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  imagePath?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  imageName?: string | null;

  @IsArray()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  images?: { path: string; name: string }[] | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  graphicLogoPath?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  graphicLogoName?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  graphicPatternPath?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  graphicPatternName?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  size?: string | null;

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
  @ValidateIf((o, v) => v !== null)
  pricepoint?: string | null;

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
