import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SamplesService } from './samples.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { UpdateSampleDto } from './dto/update-sample.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('samples')
@UseGuards(AuthGuard)
export class SamplesController {
  constructor(private readonly samplesService: SamplesService) {}

  @Get()
  findAll() {
    return this.samplesService.findAll();
  }

  @Get('next-counter')
  async getNextCounter(
    @Query('collection') collection: string,
    @Query('year') year: string,
    @Query('category') category: string,
  ) {
    const nextCounter = await this.samplesService.getNextCounter(
      collection,
      year ? parseInt(year, 10) : 0,
      category,
    );
    return { counter: nextCounter };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.samplesService.findOne(id);
  }

  @Get(':id/rounds')
  findRoundsChain(@Param('id', ParseIntPipe) id: number) {
    return this.samplesService.findRoundsChain(id);
  }

  @Post()
  create(@Body() dto: CreateSampleDto) {
    return this.samplesService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSampleDto) {
    return this.samplesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.samplesService.remove(id);
  }
}
