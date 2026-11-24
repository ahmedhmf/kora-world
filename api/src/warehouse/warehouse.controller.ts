import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { WarehouseService } from './warehouse.service';

@Controller('warehouses')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  @Get()
  list() { return this.service.warehouses(); }

  @Post()
  create(@Body() dto: { code: string; name: string; address?: string }) {
    return this.service.createWarehouse(dto);
  }

  @Get(':id/locations')
  locations(@Param('id', ParseIntPipe) id: number) { return this.service.locations(id); }

  @Post(':id/locations')
  addLocation(@Param('id', ParseIntPipe) id: number, @Body() dto: { code: string; name: string }) {
    return this.service.createLocation(id, dto);
  }

  @Get(':id/report')
  report(@Param('id',ParseIntPipe) id:number){return this.service.report(id);}

  @Get(':id/stock')
  stock(@Param('id', ParseIntPipe) id: number) { return this.service.stock(id); }

  @Get(':id/movements')
  movements(@Param('id', ParseIntPipe) id: number) { return this.service.movements(id); }

  @Post(':id/receipts')
  receive(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { locationId: number; productId: number; quantity: number; reference?: string; notes?: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.record(id, 'receipt', dto, req.user.sub);
  }

  @Post(':id/issues')
  issue(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { locationId: number; productId: number; quantity: number; reference?: string; notes?: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.record(id, 'issue', dto, req.user.sub);
  }

  @Post(':id/returns')
  returnStock(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { locationId: number; productId: number; quantity: number; reference?: string; notes?: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.record(id, 'return', dto, req.user.sub);
  }

  @Post(':id/adjustments')
  adjust(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { locationId: number; productId: number; quantity: number; reference?: string; notes?: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.record(id, 'adjustment', dto, req.user.sub);
  }

  @Post(':id/transfers')
  transfer(@Param('id', ParseIntPipe) id: number,
    @Body() dto: { fromLocationId: number; toLocationId: number; productId: number; quantity: number; notes?: string },
    @Req() req: AuthenticatedRequest) {
    return this.service.transfer(id, dto, req.user.sub);
  }
}
