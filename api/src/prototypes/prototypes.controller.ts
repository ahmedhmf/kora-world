import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PrototypesService } from './prototypes.service';
import { CreatePrototypeDto } from './dto/create-prototype.dto';
import { UpdatePrototypeDto } from './dto/update-prototype.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('prototypes')
@UseGuards(AuthGuard)
export class PrototypesController {
  constructor(private readonly prototypesService: PrototypesService) {}

  @Get()
  findAll() {
    return this.prototypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prototypesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePrototypeDto) {
    return this.prototypesService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePrototypeDto) {
    return this.prototypesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prototypesService.remove(id);
  }
}
