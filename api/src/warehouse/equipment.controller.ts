import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { EquipmentService } from './equipment.service';
@Controller('equipment')
@UseGuards(AuthGuard,RolesGuard)
@Roles('admin','employee')
export class EquipmentController {
  constructor(private readonly service:EquipmentService) {}
  @Get() catalogue(){return this.service.catalogue();}
  @Post() create(@Body() dto:Parameters<EquipmentService['create']>[0]){return this.service.create(dto);}
  @Get('warehouse/:id/stock') stock(@Param('id',ParseIntPipe) id:number){return this.service.stock(id);}
  @Get('warehouse/:id/movements') movements(@Param('id',ParseIntPipe) id:number){return this.service.movements(id);}
  @Post('warehouse/:id/movements') record(@Param('id',ParseIntPipe) id:number,@Body() dto:Parameters<EquipmentService['record']>[1],@Req() req:AuthenticatedRequest){return this.service.record(id,dto,req.user.sub);}
}
