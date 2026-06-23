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
import { SampleStatus } from '../entities/sample.entity';

export class CreateSampleDto {
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

  @IsEnum(SampleStatus)
  @IsNotEmpty()
  status: SampleStatus;

  @IsObject()
  @IsOptional()
  construction?: Record<string, string>;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsString()
  @IsOptional()
  techPackPath?: string;

  @IsString()
  @IsOptional()
  techPackName?: string;

  @IsString()
  @IsOptional()
  carrier?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsInt()
  @IsOptional()
  parentSampleId?: number | null;

  @IsInt()
  @IsOptional()
  roundNumber?: number;

  @IsObject()
  @IsOptional()
  receiptProtocol?: Record<string, unknown> | null;

  @IsString()
  @IsOptional()
  articleNumber?: string;

  @IsString()
  @IsOptional()
  collection?: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsInt()
  @IsOptional()
  articleCounter?: number;
}
