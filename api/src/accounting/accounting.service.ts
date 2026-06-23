import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingAccount } from './entities/accounting-account.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { CreateAccountingAccountDto } from './dto/create-accounting-account.dto';
import { UpdateAccountingAccountDto } from './dto/update-accounting-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(AccountingAccount)
    private readonly accountRepo: Repository<AccountingAccount>,
    @InjectRepository(JournalEntry)
    private readonly entryRepo: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private readonly lineRepo: Repository<JournalLine>,
    @InjectRepository(ExchangeRate)
    private readonly rateRepo: Repository<ExchangeRate>,
  ) {}

  // --- Chart of Accounts ---
  async createAccount(dto: CreateAccountingAccountDto): Promise<AccountingAccount> {
    const existing = await this.accountRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Account with code ${dto.code} already exists`);
    }

    const account = this.accountRepo.create({
      code: dto.code,
      name: dto.name,
      type: dto.type,
      currency: dto.currency || 'EGP',
      parentId: dto.parentId,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    if (dto.parentId) {
      const parent = await this.accountRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent account with ID ${dto.parentId} not found`);
      }
      account.parent = parent;
    }

    return this.accountRepo.save(account);
  }

  async updateAccount(id: number, dto: UpdateAccountingAccountDto): Promise<AccountingAccount> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    if (dto.code && dto.code !== account.code) {
      const existing = await this.accountRepo.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new BadRequestException(`Account with code ${dto.code} already exists`);
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        account.parent = null;
        account.parentId = null;
      } else {
        const parent = await this.accountRepo.findOne({ where: { id: dto.parentId } });
        if (!parent) {
          throw new NotFoundException(`Parent account with ID ${dto.parentId} not found`);
        }
        account.parent = parent;
        account.parentId = dto.parentId;
      }
    }

    this.accountRepo.merge(account, {
      code: dto.code,
      name: dto.name,
      type: dto.type,
      currency: dto.currency,
      isActive: dto.isActive,
    });

    return this.accountRepo.save(account);
  }

  async findAllAccounts(type?: string, codes?: string): Promise<AccountingAccount[]> {
    const query = this.accountRepo.createQueryBuilder('account')
      .leftJoinAndSelect('account.parent', 'parent');

    if (type) {
      query.andWhere('account.type = :type', { type });
    }

    if (codes) {
      const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
      if (codeList.length > 0) {
        const conditions = codeList.map((c, i) => `account.code LIKE :code_${i}`);
        const params = codeList.reduce((acc, c, i) => {
          acc[`code_${i}`] = `${c}%`;
          return acc;
        }, {} as Record<string, string>);
        query.andWhere(`(${conditions.join(' OR ')})`, params);
      }
    }

    return query.getMany();
  }

  async findAccountTree(): Promise<AccountingAccount[]> {
    const all = await this.accountRepo.find();
    const map = new Map<number, AccountingAccount & { children: AccountingAccount[] }>();
    
    all.forEach(acc => {
      map.set(acc.id, { ...acc, children: [] });
    });

    const roots: AccountingAccount[] = [];
    all.forEach(acc => {
      const mapped = map.get(acc.id)!;
      if (acc.parentId) {
        const parent = map.get(acc.parentId);
        if (parent) {
          parent.children.push(mapped);
        } else {
          roots.push(mapped);
        }
      } else {
        roots.push(mapped);
      }
    });

    return roots;
  }

  async findAccountById(id: number): Promise<AccountingAccount> {
    const account = await this.accountRepo.findOne({ where: { id }, relations: { parent: true, children: true } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return account;
  }

  // --- Exchange Rates ---
  async createExchangeRate(dto: CreateExchangeRateDto): Promise<ExchangeRate> {
    const rate = this.rateRepo.create({
      fromCurrency: dto.fromCurrency.toUpperCase(),
      toCurrency: dto.toCurrency.toUpperCase(),
      rate: dto.rate,
      date: new Date(dto.date),
    });
    return this.rateRepo.save(rate);
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string, date: Date | string): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return 1.0;

    // Find the latest rate on or before the given date
    const formattedDate = new Date(date).toISOString().split('T')[0];
    const rateRecord = await this.rateRepo.createQueryBuilder('rate')
      .where('rate.fromCurrency = :from', { from })
      .andWhere('rate.toCurrency = :to', { to })
      .andWhere('rate.date <= :date', { date: formattedDate })
      .orderBy('rate.date', 'DESC')
      .getOne();

    if (rateRecord) {
      return Number(rateRecord.rate);
    }

    // fallback: check inverse rate
    const inverseRecord = await this.rateRepo.createQueryBuilder('rate')
      .where('rate.fromCurrency = :from', { from: to })
      .andWhere('rate.toCurrency = :to', { to: from })
      .andWhere('rate.date <= :date', { date: formattedDate })
      .orderBy('rate.date', 'DESC')
      .getOne();

    if (inverseRecord) {
      return 1.0 / Number(inverseRecord.rate);
    }

    throw new BadRequestException(`No exchange rate found from ${from} to ${to} on or before ${formattedDate}`);
  }

  // --- Journal Entries ---
  async createJournalEntry(dto: CreateJournalEntryDto): Promise<JournalEntry> {
    const entry = this.entryRepo.create({
      date: new Date(dto.date),
      description: dto.description,
      reference: dto.reference,
      type: dto.type,
      poId: dto.poId,
      invoiceId: dto.invoiceId,
      attachment: dto.attachment,
    });

    let totalDebitEur = 0;
    let totalCreditEur = 0;

    const lines: JournalLine[] = [];

    for (const lineDto of dto.lines) {
      const account = await this.accountRepo.findOne({ where: { id: lineDto.accountId } });
      if (!account) {
        throw new NotFoundException(`Account with ID ${lineDto.accountId} not found`);
      }

      const debit = lineDto.debit || 0;
      const credit = lineDto.credit || 0;
      const currency = lineDto.currency.toUpperCase();

      let rate = lineDto.exchangeRate;
      if (!rate) {
        // Base currency is EGP. Convert original currency to EGP.
        rate = await this.getExchangeRate(currency, 'EGP', dto.date);
      }

      const debitBase = Number((debit * rate).toFixed(2));
      const creditBase = Number((credit * rate).toFixed(2));

      totalDebitEur += debitBase;
      totalCreditEur += creditBase;

      const line = this.lineRepo.create({
        accountId: account.id,
        debit,
        credit,
        currency,
        exchangeRate: rate,
        amountBase: Number((debitBase - creditBase).toFixed(2)),
        amountEgp: Number((debitBase - creditBase).toFixed(2)),
      });

      lines.push(line);
    }

    // Allow tiny rounding differences (e.g. up to 0.02 EGP)
    const diff = Math.abs(totalDebitEur - totalCreditEur);
    if (diff > 0.02) {
      throw new BadRequestException(
        `Journal entry is unbalanced. Total Debit: ${totalDebitEur.toFixed(2)} EGP, Total Credit: ${totalCreditEur.toFixed(2)} EGP. Difference: ${diff.toFixed(2)} EGP.`
      );
    }

    // Adjust any tiny rounding difference in the last line to make it perfectly balance
    if (diff > 0 && diff <= 0.02 && lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (totalDebitEur > totalCreditEur) {
        // Debit is higher, increase credit of the last line
        if (lastLine.credit > 0) {
          lastLine.credit = Number((lastLine.credit + diff).toFixed(2));
        } else {
          lastLine.debit = Number((lastLine.debit - diff).toFixed(2));
        }
      } else {
        // Credit is higher, increase debit of the last line
        if (lastLine.debit > 0) {
          lastLine.debit = Number((lastLine.debit + diff).toFixed(2));
        } else {
          lastLine.credit = Number((lastLine.credit - diff).toFixed(2));
        }
      }
      // Re-calculate amountBase & amountEgp
      const bal = Number(((lastLine.debit - lastLine.credit) * lastLine.exchangeRate).toFixed(2));
      lastLine.amountBase = bal;
      lastLine.amountEgp = bal;
    }

    entry.lines = lines;
    return this.entryRepo.save(entry);
  }

  async findAllJournalEntries(): Promise<JournalEntry[]> {
    return this.entryRepo.find({
      relations: { lines: { account: true } },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findJournalEntryById(id: number): Promise<JournalEntry> {
    const entry = await this.entryRepo.findOne({
      where: { id },
      relations: { lines: { account: true } },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry with ID ${id} not found`);
    }
    return entry;
  }

  async deleteJournalEntryByReference(reference: string): Promise<void> {
    const entry = await this.entryRepo.findOne({ where: { reference } });
    if (entry) {
      await this.entryRepo.remove(entry);
    }
  }
}
