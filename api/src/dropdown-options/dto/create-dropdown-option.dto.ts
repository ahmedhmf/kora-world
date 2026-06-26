import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export const ALLOWED_CATEGORIES = [
  'currency',
  'backing',
  'bladder',
  'coverMaterial',
  'bonding',
  'pricepoint',
];

export class CreateDropdownOptionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_CATEGORIES, {
    message: `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
  })
  category: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
