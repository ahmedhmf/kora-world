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
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SupplierEgpPilotService } from './supplier-egp-pilot.service';
import { CreateSupplierEgpPilotPaymentDto } from './dto/create-supplier-egp-pilot-payment.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthGuard } from '../auth/auth.guard';
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
