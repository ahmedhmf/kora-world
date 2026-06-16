import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateAccountingAccountDto } from './dto/create-accounting-account.dto';
import { UpdateAccountingAccountDto } from './dto/update-accounting-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';

@Controller('accounting')
@UseGuards(AuthGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // --- Accounts ---
  @Post('accounts')
  createAccount(@Body() dto: CreateAccountingAccountDto) {
    return this.accountingService.createAccount(dto);
  }

  @Put('accounts/:id')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountingAccountDto,
  ) {
    return this.accountingService.updateAccount(id, dto);
  }

  @Get('accounts')
  findAllAccounts(
    @Query('type') type?: string,
    @Query('codes') codes?: string,
  ) {
    return this.accountingService.findAllAccounts(type, codes);
  }

  @Get('accounts/tree')
  findAccountTree() {
    return this.accountingService.findAccountTree();
  }

  @Get('accounts/:id')
  findAccountById(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.findAccountById(id);
  }

  // --- Exchange Rates ---
  @Post('exchange-rates')
  createExchangeRate(@Body() dto: CreateExchangeRateDto) {
    return this.accountingService.createExchangeRate(dto);
  }

  @Get('exchange-rates/rate')
  getExchangeRate(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('date') date: string,
  ) {
    return this.accountingService.getExchangeRate(from, to, date);
  }

  // --- Journal Entries ---
  @Post('journal-entries')
  createJournalEntry(@Body() dto: CreateJournalEntryDto) {
    return this.accountingService.createJournalEntry(dto);
  }

  @Get('journal-entries')
  findAllJournalEntries() {
    return this.accountingService.findAllJournalEntries();
  }

  @Get('journal-entries/:id')
  findJournalEntryById(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.findJournalEntryById(id);
  }
}
