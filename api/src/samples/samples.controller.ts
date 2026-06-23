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
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { SamplesService } from './samples.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { UpdateSampleDto } from './dto/update-sample.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('samples')
@UseGuards(AuthGuard, RolesGuard)
export class SamplesController {
  constructor(private readonly samplesService: SamplesService) {}

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('supplierId') supplierId?: number,
  ) {
    if (req.user.role === 'supplier') {
      supplierId = req.user.supplierId ?? undefined;
    }
    return this.samplesService.findAll(supplierId);
  }

  @Get('next-counter')
  async getNextCounter(
    @Req() req: AuthenticatedRequest,
    @Query('collection') collection: string,
    @Query('year') year: string,
    @Query('category') category: string,
  ) {
    if (req.user.role === 'supplier') {
      throw new ForbiddenException(
        'Suppliers are not allowed to use naming counter generator',
      );
    }
    const nextCounter = await this.samplesService.getNextCounter(
      collection,
      year ? parseInt(year, 10) : 0,
      category,
    );
    return { counter: nextCounter };
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const sample = await this.samplesService.findOne(id);
    if (
      req.user.role === 'supplier' &&
      sample.supplierId !== req.user.supplierId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this sample',
      );
    }
    return sample;
  }

  @Get(':id/rounds')
  async findRoundsChain(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const sample = await this.samplesService.findOne(id);
    if (
      req.user.role === 'supplier' &&
      sample.supplierId !== req.user.supplierId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this sample rounds',
      );
    }
    return this.samplesService.findRoundsChain(id);
  }

  @Post()
  @Roles('admin', 'employee')
  create(@Body() dto: CreateSampleDto) {
    return this.samplesService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'employee')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSampleDto) {
    return this.samplesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.samplesService.remove(id);
  }
}
