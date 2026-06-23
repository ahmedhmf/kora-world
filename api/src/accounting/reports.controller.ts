import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('accounting/reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('profit-loss')
  getProfitAndLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('currency') currency?: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'startDate and endDate query parameters are required',
      );
    }
    return this.reportsService.getProfitAndLoss(startDate, endDate, currency);
  }

  @Get('balance-sheet')
  getBalanceSheet(@Query('asOfDate') asOfDate: string) {
    if (!asOfDate) {
      throw new BadRequestException('asOfDate query parameter is required');
    }
    return this.reportsService.getBalanceSheet(asOfDate);
  }

  @Get('cash-flow')
  getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'startDate and endDate query parameters are required',
      );
    }
    return this.reportsService.getCashFlow(startDate, endDate);
  }

  @Get('accounts-payable')
  getAccountsPayable() {
    return this.reportsService.getAccountsPayable();
  }

  @Get('accounts-receivable')
  getAccountsReceivable() {
    return this.reportsService.getAccountsReceivable();
  }
}
