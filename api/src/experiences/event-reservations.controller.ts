import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { EventReservationsService } from './event-reservations.service';

@Controller('events/:id/stock-reservations')
@UseGuards(AuthGuard,RolesGuard)
@Roles('admin','employee')
export class EventReservationsController {
  constructor(private readonly service:EventReservationsService){}
  @Get() list(@Param('id',ParseIntPipe) id:number){return this.service.list(id);}
  @Post('preview') preview(@Param('id',ParseIntPipe) id:number,@Body() dto:Parameters<EventReservationsService['preview']>[1]){return this.service.preview(id,dto);}
  @Post() reserve(@Param('id',ParseIntPipe) id:number,@Body() dto:Parameters<EventReservationsService['reserve']>[1],@Req() req:AuthenticatedRequest){return this.service.reserve(id,dto,req.user.sub);}
  @Post('cancel') cancel(@Param('id',ParseIntPipe) id:number,@Req() req:AuthenticatedRequest){return this.service.cancel(id,req.user.sub);}
}
