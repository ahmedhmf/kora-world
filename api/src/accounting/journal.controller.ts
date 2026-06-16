import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JournalService } from './journal.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreatePOPaymentEntryDto } from './dto/create-po-payment-entry.dto';
import { CreatePOReceiptEntryDto } from './dto/create-po-receipt-entry.dto';

@Controller('accounting/journal')
@UseGuards(AuthGuard)
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post('manual')
  createManualEntry(@Body() dto: CreateJournalEntryDto) {
    return this.journalService.createManualEntry(dto);
  }

  @Post('po-payment')
  createPOPaymentEntry(@Body() dto: CreatePOPaymentEntryDto) {
    return this.journalService.createPOPaymentEntry(
      dto.poId,
      dto.amount,
      dto.currency,
      dto.exchangeRate,
      dto.bankAccountId,
    );
  }

  @Post('po-receipt')
  createPOReceiptEntry(@Body() dto: CreatePOReceiptEntryDto) {
    return this.journalService.createPOReceiptEntry(
      dto.poId,
      dto.amount,
      dto.currency,
      dto.exchangeRate,
    );
  }

  @Get('balance/:accountId')
  getAccountBalance(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.journalService.getAccountBalance(accountId, startDate, endDate);
  }

  @Get('ledger/:accountId')
  getLedger(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.journalService.getLedger(accountId, startDate, endDate);
  }
}
