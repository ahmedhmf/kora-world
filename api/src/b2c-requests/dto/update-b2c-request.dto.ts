import { PartialType } from '@nestjs/mapped-types';
import { CreateB2cRequestDto } from './create-b2c-request.dto.js';

export class UpdateB2cRequestDto extends PartialType(CreateB2cRequestDto) {}
