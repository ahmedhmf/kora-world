import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DeliveryNotesService } from './delivery-notes.service';

@Controller('delivery-notes')
@UseGuards(AuthGuard)
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

  @Post('account/:accountId/sales')
  createSales(@Param('accountId', ParseIntPipe) accountId: number, @Body() dto: {
    weekStart: string; weekEnd: string; filePath: string; fileName: string;
    remarks?: string; items: Array<{ productId: number; quantity: number }>;
  }) {
    return this.service.createSales(accountId, dto);
  }

  @Post('sales/:id/approve')
  approveSales(@Param('id', ParseIntPipe) id: number) {
    return this.service.approveSales(id);
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
