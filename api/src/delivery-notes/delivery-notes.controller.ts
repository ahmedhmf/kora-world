import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AuthGuard } from '../auth/auth.guard';
import { DeliveryNotesService } from './delivery-notes.service';

@Controller('delivery-notes')
@UseGuards(AuthGuard, RolesGuard)
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNotesService) {}

  @Get('account/:accountId')
  list(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.service.list(accountId);
  }

  @Get('account/:accountId/inventory')
  inventory(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.service.inventory(accountId);
  }

  @Get('account/:accountId/sales')
  listSales(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.service.listSales(accountId);
  }

  @Roles('admin', 'employee')
  @Post('account/:accountId/sales')
  createSales(@Param('accountId', ParseIntPipe) accountId: number, @Body() dto: {
    weekStart: string; weekEnd: string; filePath: string; fileName: string;
    remarks?: string; items: Array<{ productId: number; quantity: number }>;
  }) {
    return this.service.createSales(accountId, dto);
  }

  @Roles('admin', 'employee')
  @Post('sales/:id/approve')
  approveSales(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.service.approveSales(id, req.user);
  }

  @Roles('admin', 'employee')
  @Patch('sales/:id/draft')
  updateSalesDraft(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { items: Array<{ productId: number; quantity: number }>; remarks?: string }) {
    return this.service.updateSalesDraft(id, dto);
  }

  @Roles('admin', 'employee')
  @Post('sales/:id/cancel')
  cancelSales(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { reason: string }, @Req() req: AuthenticatedRequest) {
    return this.service.cancelSales(id, dto.reason, req.user);
  }

  @Get('account/:accountId/adjustments')
  listAdjustments(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.service.listAdjustments(accountId);
  }

  @Roles('admin', 'employee')
  @Post('account/:accountId/adjustments')
  adjustInventory(@Param('accountId', ParseIntPipe) accountId: number,
    @Body() dto: { productId: number; quantity: number; reason: string; notes: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.adjustInventory(accountId, dto, req.user);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post('account/:accountId')
  create(@Param('accountId', ParseIntPipe) accountId: number, @Body() dto: { deliveryDate: string; remarks?: string; items: Array<{ productId: number; quantity: number }> }) {
    return this.service.create(accountId, dto);
  }

  @Patch(':id/signed-copy')
  attachSignedCopy(@Param('id', ParseIntPipe) id: number, @Body() dto: { path: string; name: string }) {
    return this.service.attachSignedCopy(id, dto);
  }
}
