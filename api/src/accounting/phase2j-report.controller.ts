import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Phase2JReportService } from './phase2j-report.service';

@Controller('accounting/phase2j-report')
@UseGuards(AuthGuard, RolesGuard)
export class Phase2JReportController {
  constructor(private readonly report: Phase2JReportService) {}

  @Get()
  @Roles('admin', 'accountant')
  get(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    return this.report.get(startDate, endDate, asOfDate);
  }
}
