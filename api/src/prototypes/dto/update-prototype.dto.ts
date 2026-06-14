import { PartialType } from '@nestjs/mapped-types';
import { CreatePrototypeDto } from './create-prototype.dto';

export class UpdatePrototypeDto extends PartialType(CreatePrototypeDto) {}
