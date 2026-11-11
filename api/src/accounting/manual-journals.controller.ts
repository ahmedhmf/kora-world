import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JournalWorkflowService } from './journal-workflow.service';
import type { PostingLine } from './accounting-posting.service';

/**
 * New opt-in manual journal endpoints. Legacy journal routes are not migrated.
 * User identity is read from the authenticated session; roles are rechecked
 * against the database by JournalWorkflowService.
 */
@Controller('accounting/manual-journals')
@UseGuards(AuthGuard)
export class ManualJournalsController {
  constructor(private readonly workflow: JournalWorkflowService) {}

  @Post('drafts')
  createDraft(
    @Body() body: {
      date: string;
      description: string;
      reference?: string;
      lines: PostingLine[];
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workflow.createDraft(body, req.user.sub);
  }

  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.workflow.submit(id, req.user.sub);
  }

  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.workflow.approveAndPost(id, req.user.sub);
  }

  @Post(':id/reverse')
  reverse(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workflow.reverse(id, req.user.sub, body?.reason);
  }
}
