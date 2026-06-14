import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEnum,
  IsPositive,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { POStatus } from '../entities/purchase-order.entity';

export class CreatePurchaseOrderLineItemDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

export class CreatePurchaseOrderDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  supplierId: number;

  @IsDateString()
  @IsNotEmpty()
  orderDate: string;

  @IsDateString()
  @IsOptional()
  expectedDelivery?: string;

  @IsEnum(POStatus)
  @IsOptional()
  status?: POStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineItemDto)
  @ArrayNotEmpty()
  lineItems: CreatePurchaseOrderLineItemDto[];

  @IsString()
  @IsOptional()
  carrier?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;
}
