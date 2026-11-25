import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InvoicePaymentReconciliationService } from './invoice-payment-reconciliation.service';

/** Admin-only, default-off, read-only test database diagnostic. */
@Controller('accounting/reconciliation-audit')
@UseGuards(AuthGuard, RolesGuard)
export class InvoicePaymentReconciliationController {
  constructor(private readonly reconciliation: InvoicePaymentReconciliationService) {}

  @Get()
  @Roles('admin')
  audit() {
    return this.reconciliation.audit();
  }
}
