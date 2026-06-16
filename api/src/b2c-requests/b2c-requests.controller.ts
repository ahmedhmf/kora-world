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
import { B2cRequestsService } from './b2c-requests.service.js';
import { CreateB2cRequestDto } from './dto/create-b2c-request.dto.js';
import { UpdateB2cRequestDto } from './dto/update-b2c-request.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('b2c-requests')
@UseGuards(AuthGuard)
export class B2cRequestsController {
  constructor(private readonly b2cService: B2cRequestsService) {}

  @Get()
  findAll() {
    return this.b2cService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.b2cService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateB2cRequestDto) {
    return this.b2cService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateB2cRequestDto,
  ) {
    return this.b2cService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.b2cService.remove(id);
  }
}
