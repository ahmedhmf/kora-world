import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { SimpleAccountingService, SimpleTransactionInput } from './simple-accounting.service';

@Controller('accounting/simple')
@UseGuards(AuthGuard)
export class SimpleAccountingController {
  constructor(private readonly service: SimpleAccountingService) {}

  @Post('transactions')
  create(@Body() input: SimpleTransactionInput, @Req() req: AuthenticatedRequest) {
    return this.service.create(input, req.user.sub);
  }
}
