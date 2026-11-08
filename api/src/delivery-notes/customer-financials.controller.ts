import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CustomerStatementsService } from './customer-statements.service';
import { CustomerFinancialsService } from './customer-financials.service';
import type { PricingKind } from './customer-pricing-rule.entity';

@Controller('customer-financials')
@UseGuards(AuthGuard, RolesGuard)
export class CustomerFinancialsController {
  constructor(private readonly service: CustomerFinancialsService, private readonly statements: CustomerStatementsService) {}

  @Get('account/:accountId/statements/preview')
  previewStatement(@Param('accountId', ParseIntPipe) id: number,
    @Query('from') from: string, @Query('to') to: string, @Query('currency') currency?: string) {
    return this.statements.preview(id, from, to, currency);
  }

  @Get('account/:accountId/statements')
  statementHistory(@Param('accountId', ParseIntPipe) id: number) { return this.statements.history(id); }

  @Get('account/:accountId/statements/:statementId')
  savedStatement(@Param('accountId', ParseIntPipe) id: number,
    @Param('statementId', ParseIntPipe) statementId: number) {
    return this.statements.getSaved(id, statementId);
  }

  @Roles('admin', 'employee')
  @Post('account/:accountId/statements')
  saveStatement(@Param('accountId', ParseIntPipe) id: number,
    @Body() dto: { from: string; to: string; currency?: string },
    @Req() req: AuthenticatedRequest) {
    return this.statements.save(id, dto, req.user.sub);
  }

  @Get('account/:accountId/pricing')
  pricing(@Param('accountId', ParseIntPipe) id: number) { return this.service.pricing(id); }

  @Roles('admin', 'employee')
  @Post('account/:accountId/pricing')
  addPricing(@Param('accountId', ParseIntPipe) id: number,
    @Body() dto: { productId: number; kind: PricingKind; unitPrice?: string; commissionPercent?: string; agreedRetailPrice?: string; effectiveFrom: string; effectiveTo?: string },
    @Req() req: AuthenticatedRequest) { return this.service.addPricing(id, dto, req.user); }

  @Get('sales/:reportId/preview')
  preview(@Param('reportId', ParseIntPipe) id: number) { return this.service.preview(id); }

  @Get('account/:accountId/overview')
  overview(@Param('accountId', ParseIntPipe) id: number) { return this.service.overview(id); }

  @Roles('admin', 'employee')
  @Post('account/:accountId/payments')
  recordPayment(@Param('accountId', ParseIntPipe) id: number,
    @Body() dto: { amount: string; paymentDate: string; reference: string; method: string },
    @Req() req: AuthenticatedRequest) { return this.service.recordPayment(id, dto, req.user); }

  @Roles('admin', 'employee')
  @Post('account/:accountId/allocations')
  allocate(@Param('accountId', ParseIntPipe) id: number,
    @Body() dto: { paymentId: number; settlementId: number; amount: string },
    @Req() req: AuthenticatedRequest) { return this.service.allocate(id, dto, req.user); }
}
