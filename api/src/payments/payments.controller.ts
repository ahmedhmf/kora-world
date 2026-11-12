import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SupplierEgpPilotService } from './supplier-egp-pilot.service';
import { CreateSupplierEgpPilotPaymentDto } from './dto/create-supplier-egp-pilot-payment.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
@UseGuards(AuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly supplierEgpPilot: SupplierEgpPilotService,
  ) {}

  /**
   * Test-only supplier settlement pilot: off by default, admin-only, EGP-only.
   * Intentionally distinct from the legacy POST /payments endpoint.
   */
  @Post('supplier-egp-pilot')
  @Roles('admin')
  createSupplierEgpPilot(@Body() dto: CreateSupplierEgpPilotPaymentDto) {
    return this.supplierEgpPilot.create(dto);
  }

  /**
   * Test-only supplier payment reversal. Existing payment/journal rows are
   * preserved, and actor identity comes from the verified session.
   */
  @Post('supplier-egp-pilot/:id/reverse')
  @Roles('accountant', 'admin')
  reverseSupplierEgpPilot(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.supplierEgpPilot.reverse(id, req.user.sub, body?.reason || '');
  }

  /**
   * Test-only, reversal-aware supplier balances; never changes legacy reports.
   * A static path must precede the parameterized invoice detail route.
   */
  @Get('supplier-egp-pilot/accounts-payable')
  @Roles('accountant', 'admin')
  pilotAccountsPayable() {
    return this.supplierEgpPilot.getPilotAccountsPayable();
  }

  @Get('supplier-egp-pilot/invoices/:id/balance')
  @Roles('accountant', 'admin')
  pilotInvoiceBalance(@Param('id', ParseIntPipe) id: number) {
    return this.supplierEgpPilot.getInvoiceBalance(id);
  }

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.remove(id);
  }
}
