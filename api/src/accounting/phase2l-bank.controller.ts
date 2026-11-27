import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Phase2LBankService } from './phase2l-bank.service';
import type { ImportInput, OpeningInput } from './phase2l-bank.service';

@Controller('accounting/phase2l')
@UseGuards(AuthGuard, RolesGuard)
export class Phase2LBankController {
  constructor(private readonly service: Phase2LBankService) {}

  @Post('opening')
  @Roles('admin')
  opening(@Body() body: OpeningInput, @Req() req: AuthenticatedRequest) {
    return this.service.postOpening(body, req.user.sub);
  }

  @Post('statements')
  @Roles('admin')
  import(@Body() body: ImportInput, @Req() req: AuthenticatedRequest) {
    return this.service.importStatement(body, req.user.sub);
  }

  @Get('statements')
  @Roles('admin', 'accountant')
  list(@Query('accountId', ParseIntPipe) accountId: number) {
    return this.service.list(accountId);
  }

  @Post('rows/:id/match')
  @Roles('admin')
  match(@Param('id', ParseIntPipe) id: number,
    @Body() body: { journalLineId: number; reason: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.match(id, body?.journalLineId, body?.reason, req.user.sub);
  }

  @Post('rows/:id/unmatch')
  @Roles('admin')
  unmatch(@Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string }, @Req() req: AuthenticatedRequest) {
    return this.service.unmatch(id, body?.reason, req.user.sub);
  }
}
