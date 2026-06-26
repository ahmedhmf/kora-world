import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { DropdownOptionsService } from './dropdown-options.service';
import { CreateDropdownOptionDto } from './dto/create-dropdown-option.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dropdown-options')
@UseGuards(AuthGuard)
export class DropdownOptionsController {
  constructor(
    private readonly optionsService: DropdownOptionsService,
  ) {}

  @Get()
  findAll(@Query('category') category?: string) {
    return this.optionsService.findAll(category);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateDropdownOptionDto) {
    return this.optionsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDropdownOptionDto,
  ) {
    return this.optionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.optionsService.remove(id);
  }
}
