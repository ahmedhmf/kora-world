import { Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ControlledSupplierInvoiceBookingService } from './controlled-supplier-invoice-booking.service';

/** Explicitly separate from legacy PUT /invoices/:id; default-off and local-only. */
@Controller('invoices/controlled-egp-pilot')
@UseGuards(AuthGuard, RolesGuard)
export class ControlledSupplierInvoiceBookingController {
  constructor(private readonly booking: ControlledSupplierInvoiceBookingService) {}

  @Post(':id/book')
  @Roles('admin')
  book(@Param('id', ParseIntPipe) id: number) {
    return this.booking.post(id);
  }
}
