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
