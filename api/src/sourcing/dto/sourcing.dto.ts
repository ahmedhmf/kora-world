import { IsEnum, IsString, IsArray, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';

export class SourcingQueryDto {
  @IsEnum(['football', 'handball'])
  sport: 'football' | 'handball';

  @IsEnum(['match_pro', 'competition', 'training', 'club'])
  tier: 'match_pro' | 'competition' | 'training' | 'club';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @IsString()
  @IsOptional()
  targetMarket?: string;

  @IsString()
  @IsOptional()
  budgetPerUnit?: string;

  @IsNumber()
  @IsOptional()
  moqMax?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SupplierResult {
  name: string;
  country: string;
  tierFit: string;
  coverMaterial: string;
  bladder: string;
  stitching: string;
  certifications: string[];
  estimatedMoq: string;
  estimatedFobPrice: string;
  paymentMethods: string[];
  contactInfo: string;
  notes: string;
  score: number;
}

export class SourcingResultDto {
  suppliers: SupplierResult[];
  recommended: string;
  reasoning: string;
  contactEmailDraft: string;
}
