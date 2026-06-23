import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountingAccountDto } from './create-accounting-account.dto';

export class UpdateAccountingAccountDto extends PartialType(
  CreateAccountingAccountDto,
) {}
