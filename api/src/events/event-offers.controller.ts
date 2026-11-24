import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EventOffersService } from './event-offers.service';

@Controller('events/:eventId/offers')
@UseGuards(AuthGuard)
export class EventOffersController {
  constructor(private readonly service: EventOffersService) {}

  @Get()
  list(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.list(eventId);
  }

  @Post()
  create(@Param('eventId', ParseIntPipe) eventId: number, @Body() body: unknown) {
    return this.service.create(eventId, body);
  }

  @Put(':offerId')
  update(@Param('eventId', ParseIntPipe) eventId: number, @Param('offerId', ParseIntPipe) offerId: number, @Body() body: unknown) {
    return this.service.update(eventId, offerId, body);
  }

  @Delete(':offerId')
  remove(@Param('eventId', ParseIntPipe) eventId: number, @Param('offerId', ParseIntPipe) offerId: number) {
    return this.service.remove(eventId, offerId);
  }
}
