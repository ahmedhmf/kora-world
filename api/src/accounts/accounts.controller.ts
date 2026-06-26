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
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.remove(id);
  }

  @Put(':id/forecasts')
  updateForecasts(
    @Param('id', ParseIntPipe) id: number,
    @Body() forecasts: any[],
  ) {
    return this.accountsService.updateForecasts(id, forecasts);
  }

  @Post(':id/forecasts/:forecastId/create-pos')
  createPOs(
    @Param('id', ParseIntPipe) id: number,
    @Param('forecastId') forecastId: string,
    @Body() body?: { items?: Array<{ productId: number; quantity: number }> },
  ) {
    return this.accountsService.createPOsFromForecast(id, forecastId, body?.items);
  }
}
