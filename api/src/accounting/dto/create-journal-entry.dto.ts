import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalEntryType } from '../entities/journal-entry.entity';
import { CreateJournalLineDto } from './create-journal-line.dto';

export class CreateJournalEntryDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsEnum(JournalEntryType)
  @IsNotEmpty()
  type: JournalEntryType;

  @IsInt()
  @IsOptional()
  poId?: number;

  @IsInt()
  @IsOptional()
  invoiceId?: number;

  @IsString()
  @IsOptional()
  attachment?: string;

  @ValidateNested({ each: true })
  @ArrayMinSize(2, { message: 'A journal entry must have at least 2 lines' })
  @Type(() => CreateJournalLineDto)
  lines: CreateJournalLineDto[];
}
