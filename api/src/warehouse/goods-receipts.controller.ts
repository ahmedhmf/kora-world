import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { GoodsReceiptsService } from './goods-receipts.service';

@Controller('purchase-orders/:id/goods-receipts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class GoodsReceiptsController {
  constructor(private readonly service: GoodsReceiptsService) {}
  @Get()
  overview(@Param('id', ParseIntPipe) id: number) { return this.service.overview(id); }
  @Post()
  receive(@Param('id', ParseIntPipe) id: number, @Body() dto: Parameters<GoodsReceiptsService['receive']>[1],
    @Req() req: AuthenticatedRequest) { return this.service.receive(id, dto, req.user.sub); }
}
