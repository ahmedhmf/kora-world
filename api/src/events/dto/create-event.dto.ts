import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsISO8601,
  IsEnum,
} from 'class-validator';

export enum EventCategory {
  FOOTBALL = 'football',
  HANDBALL = 'handball',
  CULTURAL = 'cultural',
  TRADE_SHOW = 'trade_show',
  OTHER = 'other',
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventCategory)
  @IsNotEmpty()
  category: EventCategory;

  @IsISO8601()
  @IsNotEmpty()
  startDate: string;

  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  location?: string;
}
