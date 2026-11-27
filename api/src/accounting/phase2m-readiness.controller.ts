import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Phase2MReadinessService } from './phase2m-readiness.service';

/** Local kora_test admin-only read-only historical reconciliation diagnostic. */
@Controller('accounting/phase2m-readiness')
@UseGuards(AuthGuard, RolesGuard)
export class Phase2MReadinessController {
  constructor(private readonly service: Phase2MReadinessService) {}

  @Get()
  @Roles('admin')
  audit() {
    return this.service.audit();
  }
}
