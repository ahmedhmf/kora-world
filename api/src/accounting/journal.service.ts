import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingService } from './accounting.service';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

@Injectable()
export class JournalService {
  constructor(
    private readonly accountingService: AccountingService,
    @InjectRepository(AccountingAccount)
    private readonly accountRepo: Repository<AccountingAccount>,
    @InjectRepository(JournalEntry)
    private readonly entryRepo: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private readonly lineRepo: Repository<JournalLine>,
  ) {}

  async createManualEntry(dto: CreateJournalEntryDto): Promise<JournalEntry> {
    return this.accountingService.createJournalEntry(dto);
  }

  async createPOPaymentEntry(
    poId: number,
    amount: number,
    currency: string,
    exchangeRate: number,
    bankAccountId: number,
  ): Promise<JournalEntry> {
    // Validate bank account exists and is active
    const bankAccount = await this.accountRepo.findOne({ where: { id: bankAccountId } });
    if (!bankAccount) {
      throw new NotFoundException(`Bank account with ID ${bankAccountId} not found`);
    }

    // Resolve Accounts Payable
    const accounts = await this.accountingService.findAllAccounts();
    const apAccount = accounts.find(a => a.code === '2100');
    if (!apAccount) {
      throw new NotFoundException('Accounts Payable (code 2100) not found. Please seed accounts.');
    }

    const currUpper = currency.toUpperCase();
    const lines = [
      {
        accountId: apAccount.id,
        debit: amount,
        currency: currUpper,
        exchangeRate,
      },
      {
        accountId: bankAccount.id,
        credit: amount,
        currency: currUpper,
        exchangeRate,
      },
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    return this.accountingService.createJournalEntry({
      date: todayStr,
      description: `Payment for Purchase Order #${poId}`,
      reference: `PO-PAY-${poId}`,
      type: JournalEntryType.PAYMENT,
      poId,
      lines,
    });
  }

  async createPOReceiptEntry(
    poId: number,
    amount: number,
    currency: string,
    exchangeRate: number,
  ): Promise<JournalEntry> {
    // Resolve Inventory (1300) and Accounts Payable (2100)
    const accounts = await this.accountingService.findAllAccounts();
    const inventoryAccount = accounts.find(a => a.code === '1300');
    const apAccount = accounts.find(a => a.code === '2100');

    if (!inventoryAccount || !apAccount) {
      throw new NotFoundException('Inventory (code 1300) or Accounts Payable (code 2100) not found. Please seed accounts.');
    }

    const currUpper = currency.toUpperCase();
    const lines = [
      {
        accountId: inventoryAccount.id,
        debit: amount,
        currency: currUpper,
        exchangeRate,
      },
      {
        accountId: apAccount.id,
        credit: amount,
        currency: currUpper,
        exchangeRate,
      },
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    return this.accountingService.createJournalEntry({
      date: todayStr,
      description: `Receipt for Purchase Order #${poId}`,
      reference: `PO-REC-${poId}`,
      type: JournalEntryType.PO,
      poId,
      lines,
    });
  }

  async getAccountBalance(
    accountId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    account: AccountingAccount;
    totalDebit: number;
    totalCredit: number;
    rawBalance: number;
    balance: number;
  }> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    const query = this.lineRepo.createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'entry')
      .select('SUM(line.debit)', 'totalDebit')
      .addSelect('SUM(line.credit)', 'totalCredit')
      .where('line.accountId = :accountId', { accountId });

    if (startDate) {
      query.andWhere('entry.date >= :startDate', { startDate: new Date(startDate).toISOString().split('T')[0] });
    }
    if (endDate) {
      query.andWhere('entry.date <= :endDate', { endDate: new Date(endDate).toISOString().split('T')[0] });
    }

    const result = await query.getRawOne();
    const totalDebit = parseFloat(result?.totalDebit) || 0;
    const totalCredit = parseFloat(result?.totalCredit) || 0;

    // raw balance is debit - credit
    const rawBalance = Number((totalDebit - totalCredit).toFixed(2));

    // balance adjusted to normal account type behavior
    let balance = rawBalance;
    const type = account.type;
    if (
      type === AccountType.LIABILITY ||
      type === AccountType.EQUITY ||
      type === AccountType.REVENUE
    ) {
      balance = Number((totalCredit - totalDebit).toFixed(2));
    }

    return {
      account,
      totalDebit,
      totalCredit,
      rawBalance,
      balance,
    };
  }

  async getLedger(
    accountId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    account: AccountingAccount;
    lines: Array<{
      id: number;
      date: Date | string;
      description?: string;
      reference?: string;
      debit: number;
      credit: number;
      currency: string;
      exchangeRate: number;
      amountEur: number;
      runningBalance: number;
    }>;
  }> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    // First fetch lines before the start date to calculate opening balance if startDate is specified
    let openingBalance = 0;
    if (startDate) {
      const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
      const openingQuery = this.lineRepo.createQueryBuilder('line')
        .innerJoin('line.journalEntry', 'entry')
        .select('SUM(line.debit)', 'totalDebit')
        .addSelect('SUM(line.credit)', 'totalCredit')
        .where('line.accountId = :accountId', { accountId })
        .andWhere('entry.date < :startDate', { startDate: formattedStartDate });

      const openingRes = await openingQuery.getRawOne();
      const opDebit = parseFloat(openingRes?.totalDebit) || 0;
      const opCredit = parseFloat(openingRes?.totalCredit) || 0;
      
      const rawOpBalance = opDebit - opCredit;
      openingBalance = rawOpBalance;
    }

    // Now fetch main ledger lines
    const query = this.lineRepo.createQueryBuilder('line')
      .innerJoinAndSelect('line.journalEntry', 'entry')
      .where('line.accountId = :accountId', { accountId })
      .orderBy('entry.date', 'ASC')
      .addOrderBy('entry.createdAt', 'ASC')
      .addOrderBy('line.id', 'ASC');

    if (startDate) {
      query.andWhere('entry.date >= :startDate', { startDate: new Date(startDate).toISOString().split('T')[0] });
    }
    if (endDate) {
      query.andWhere('entry.date <= :endDate', { endDate: new Date(endDate).toISOString().split('T')[0] });
    }

    const lines = await query.getMany();
    
    let currentBalance = openingBalance;
    const ledgerLines = lines.map(line => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      currentBalance = Number((currentBalance + debit - credit).toFixed(2));

      return {
        id: line.id,
        date: line.journalEntry.date,
        description: line.journalEntry.description,
        reference: line.journalEntry.reference,
        debit,
        credit,
        currency: line.currency,
        exchangeRate: Number(line.exchangeRate),
        amountEur: Number(line.amountEur),
        runningBalance: currentBalance,
      };
    });

    return {
      account,
      lines: ledgerLines,
    };
  }
}
