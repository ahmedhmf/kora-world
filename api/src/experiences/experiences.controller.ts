import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ExperiencesService } from './experiences.service';

@Controller('experiences')
@UseGuards(AuthGuard)
export class ExperiencesController {
  constructor(private readonly service: ExperiencesService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() dto: unknown) { return this.service.create(dto); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: unknown) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Controller('events')
@UseGuards(AuthGuard)
export class EventExperiencesController {
  constructor(private readonly service: ExperiencesService) {}
  @Get(':id/experiences') selected(@Param('id', ParseIntPipe) id: number) { return this.service.selected(id); }
  @Put(':id/experiences') assign(@Param('id', ParseIntPipe) id: number, @Body() dto: { experienceIds?: number[] }) {
    return this.service.assign(id, dto?.experienceIds);
  }
  @Get(':id/experience-checklist') checklist(@Param('id', ParseIntPipe) id: number) { return this.service.checklist(id); }
  @Post(':id/experience-checklist/generate') generate(@Param('id', ParseIntPipe) id: number) { return this.service.generate(id); }
  @Patch(':id/experience-checklist/:key') setItem(@Param('id', ParseIntPipe) id: number, @Param('key') key: string, @Body() dto: { packed?: boolean }) {
    return this.service.setPacked(id, key, dto?.packed);
  }
  @Post(':id/experience-checklist/items') addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: unknown) { return this.service.addEventItem(id, dto); }
}
