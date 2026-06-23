import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingService } from './accounting.service';
import { JournalLine } from './entities/journal-line.entity';
import {
  AccountingAccount,
  AccountType,
} from './entities/accounting-account.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentsService } from '../payments/payments.service';
import {
  InvoiceType,
  InvoiceStatus,
} from '../invoices/entities/invoice.entity';

interface OutstandingInvoice {
  id: number;
  number: string;
  date: Date | string;
  dueDate: Date | string;
  total: number;
  paid: number;
  outstanding: number;
  currency: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(forwardRef(() => AccountingService))
    private readonly accountingService: AccountingService,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @InjectRepository(AccountingAccount)
    private readonly accountRepo: Repository<AccountingAccount>,
    @InjectRepository(JournalLine)
    private readonly lineRepo: Repository<JournalLine>,
  ) {}

  // 1. Profit & Loss Report
  async getProfitAndLoss(
    startDate: string,
    endDate: string,
    currency?: string,
  ): Promise<{
    revenue: Array<{ code: string; name: string; amount: number }>;
    expenses: Array<{ code: string; name: string; amount: number }>;
    grossProfit: number;
    netProfit: number;
    currency: string;
  }> {
    const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
    const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
    const targetCurrency = currency ? currency.toUpperCase() : 'EGP';

    const lines = await this.lineRepo
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.journalEntry', 'entry')
      .innerJoinAndSelect('line.account', 'account')
      .where('entry.date >= :startDate', { startDate: formattedStartDate })
      .andWhere('entry.date <= :endDate', { endDate: formattedEndDate })
      .andWhere('account.type IN (:...types)', {
        types: [AccountType.REVENUE, AccountType.EXPENSE],
      })
      .getMany();

    const revenueMap = new Map<string, { name: string; amountBase: number }>();
    const expenseMap = new Map<string, { name: string; amountBase: number }>();

    // Load all accounts to include them with 0 if needed, or just aggregate from transactions
    for (const line of lines) {
      const acc = line.account;
      const code = acc.code;
      const amountBase = Number(line.amountBase || 0); // amountBase is debit - credit

      if (acc.type === AccountType.REVENUE) {
        const existing = revenueMap.get(code) || {
          name: acc.name,
          amountBase: 0,
        };
        // Revenue increases with Credit (amountBase is negative for credit), so subtract amountBase to get positive revenue
        existing.amountBase = Number(
          (existing.amountBase - amountBase).toFixed(2),
        );
        revenueMap.set(code, existing);
      } else {
        const existing = expenseMap.get(code) || {
          name: acc.name,
          amountBase: 0,
        };
        // Expense increases with Debit (amountBase is positive for debit), so add amountBase
        existing.amountBase = Number(
          (existing.amountBase + amountBase).toFixed(2),
        );
        expenseMap.set(code, existing);
      }
    }

    // Convert to target currency if necessary (from EGP)
    const convert = async (egpAmt: number): Promise<number> => {
      if (targetCurrency === 'EGP') return egpAmt;
      try {
        const rate = await this.accountingService.getExchangeRate(
          'EGP',
          targetCurrency,
          endDate,
        );
        return Number((egpAmt * rate).toFixed(2));
      } catch {
        // Fallback to 1.0 if exchange rate cannot be resolved
        return egpAmt;
      }
    };

    const revenueList: Array<{
      code: string;
      name: string;
      amount: number;
    }> = [];
    let totalRevenue = 0;
    for (const [code, val] of revenueMap.entries()) {
      const amount = await convert(val.amountBase);
      revenueList.push({ code, name: val.name, amount });
      totalRevenue += amount;
    }

    const expenseList: Array<{
      code: string;
      name: string;
      amount: number;
    }> = [];
    let totalExpenses = 0;
    let totalCOGS = 0;
    for (const [code, val] of expenseMap.entries()) {
      const amount = await convert(val.amountBase);
      expenseList.push({ code, name: val.name, amount });
      totalExpenses += amount;
      if (code.startsWith('51')) {
        totalCOGS += amount;
      }
    }

    const grossProfit = Number((totalRevenue - totalCOGS).toFixed(2));
    const netProfit = Number((totalRevenue - totalExpenses).toFixed(2));

    return {
      revenue: revenueList,
      expenses: expenseList,
      grossProfit,
      netProfit,
      currency: targetCurrency,
    };
  }

  // 2. Balance Sheet
  async getBalanceSheet(asOfDate: string): Promise<{
    assets: Array<{ code: string; name: string; balance: number }>;
    liabilities: Array<{ code: string; name: string; balance: number }>;
    equity: Array<{ code: string; name: string; balance: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    isBalanced: boolean;
    difference: number;
  }> {
    const formattedAsOf = new Date(asOfDate).toISOString().split('T')[0];

    const accounts = await this.accountRepo.find();
    const balances = new Map<number, number>();

    // Initialize all account balances to 0
    accounts.forEach((acc) => balances.set(acc.id, 0));

    const lines = (await this.lineRepo
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'entry')
      .select('line.accountId', 'accountId')
      .addSelect('SUM(line.amount_base)', 'totalAmountBase')
      .where('entry.date <= :asOfDate', { asOfDate: formattedAsOf })
      .groupBy('line.accountId')
      .getRawMany()) as unknown as Array<{
      accountId: string;
      totalAmountBase: string;
    }>;

    lines.forEach((row) => {
      const accId = parseInt(row.accountId);
      const amtBase = parseFloat(row.totalAmountBase) || 0;
      balances.set(accId, Number(amtBase.toFixed(2))); // balance in base currency (EGP)
    });

    const assetsList: Array<{
      code: string;
      name: string;
      balance: number;
    }> = [];
    const liabilitiesList: Array<{
      code: string;
      name: string;
      balance: number;
    }> = [];
    const equityList: Array<{
      code: string;
      name: string;
      balance: number;
    }> = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const acc of accounts) {
      const rawBal = balances.get(acc.id) || 0;
      if (acc.type === AccountType.ASSET) {
        const balance = rawBal;
        if (balance !== 0 || acc.isActive) {
          assetsList.push({ code: acc.code, name: acc.name, balance });
          totalAssets += balance;
        }
      } else if (acc.type === AccountType.LIABILITY) {
        const balance = -rawBal; // normal credit balance
        if (balance !== 0 || acc.isActive) {
          liabilitiesList.push({ code: acc.code, name: acc.name, balance });
          totalLiabilities += balance;
        }
      } else if (acc.type === AccountType.EQUITY) {
        const balance = -rawBal; // normal credit balance
        if (balance !== 0 || acc.isActive) {
          equityList.push({ code: acc.code, name: acc.name, balance });
          totalEquity += balance;
        }
      }
    }

    totalAssets = Number(totalAssets.toFixed(2));
    totalLiabilities = Number(totalLiabilities.toFixed(2));
    totalEquity = Number(totalEquity.toFixed(2));

    const liabilitiesAndEquity = Number(
      (totalLiabilities + totalEquity).toFixed(2),
    );
    const difference = Number(
      Math.abs(totalAssets - liabilitiesAndEquity).toFixed(2),
    );
    const isBalanced = difference <= 0.02;

    return {
      assets: assetsList,
      liabilities: liabilitiesList,
      equity: equityList,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
      difference,
    };
  }

  // 3. Cash Flow Statement
  async getCashFlow(
    startDate: string,
    endDate: string,
  ): Promise<
    Array<{
      period: string; // YYYY-MM
      inflows: number;
      outflows: number;
      netChange: number;
    }>
  > {
    const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
    const formattedEndDate = new Date(endDate).toISOString().split('T')[0];

    const lines = await this.lineRepo
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.journalEntry', 'entry')
      .innerJoinAndSelect('line.account', 'account')
      .where('entry.date >= :startDate', { startDate: formattedStartDate })
      .andWhere('entry.date <= :endDate', { endDate: formattedEndDate })
      .andWhere('account.code IN (:...codes)', {
        codes: ['1101', '1102', '1103'],
      })
      .orderBy('entry.date', 'ASC')
      .getMany();

    const monthlyMap = new Map<string, { inflows: number; outflows: number }>();

    for (const line of lines) {
      const entryDate = new Date(line.journalEntry.date);
      const period = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

      const existing = monthlyMap.get(period) || { inflows: 0, outflows: 0 };

      const debit = Number(line.debit);
      const credit = Number(line.credit);

      // Debit to bank account = cash inflow
      // Credit to bank account = cash outflow
      existing.inflows = Number((existing.inflows + debit).toFixed(2));
      existing.outflows = Number((existing.outflows + credit).toFixed(2));

      monthlyMap.set(period, existing);
    }

    const result: Array<{
      period: string;
      inflows: number;
      outflows: number;
      netChange: number;
    }> = [];
    for (const [period, val] of monthlyMap.entries()) {
      result.push({
        period,
        inflows: val.inflows,
        outflows: val.outflows,
        netChange: Number((val.inflows - val.outflows).toFixed(2)),
      });
    }

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  // 4. Accounts Payable Report
  async getAccountsPayable(): Promise<
    Array<{
      supplierId: number;
      supplierName: string;
      totalOutstanding: number;
      invoices: Array<{
        id: number;
        number: string;
        date: Date | string;
        dueDate: Date | string;
        total: number;
        paid: number;
        outstanding: number;
        currency: string;
      }>;
    }>
  > {
    const invoices = await this.invoicesService.findAll();
    const payments = await this.paymentsService.findAll();

    const incoming = invoices.filter(
      (inv) =>
        inv.type === InvoiceType.INCOMING &&
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.CANCELLED,
    );

    const supplierMap = new Map<
      number,
      {
        name: string;
        invoices: OutstandingInvoice[];
        totalOutstandingEgp: number;
      }
    >();

    for (const inv of incoming) {
      const supplierId = inv.supplierId || 0;
      const supplierName =
        inv.supplier?.name || inv.customerName || 'Unknown Supplier';

      // Sum payments for this invoice
      const invPayments = payments.filter((p) => p.invoiceId === inv.id);
      let totalPaid = 0;
      for (const p of invPayments) {
        if (p.currency.toUpperCase() === inv.currency.toUpperCase()) {
          totalPaid += p.amount;
        } else {
          // simple convert
          const rate = await this.accountingService.getExchangeRate(
            p.currency,
            inv.currency,
            p.date,
          );
          totalPaid += p.amount * rate;
        }
      }
      totalPaid = Number(totalPaid.toFixed(2));
      const outstanding = Number((inv.total - totalPaid).toFixed(2));

      if (outstanding <= 0) continue;

      const existing = supplierMap.get(supplierId) || {
        name: supplierName,
        invoices: [],
        totalOutstandingEgp: 0,
      };

      // Calculate outstanding in EGP for supplier total aggregation
      const rateToEgp = await this.accountingService.getExchangeRate(
        inv.currency,
        'EGP',
        inv.date,
      );
      const outstandingEgp = Number((outstanding * rateToEgp).toFixed(2));

      existing.invoices.push({
        id: inv.id,
        number: inv.number,
        date: inv.date,
        dueDate: inv.dueDate,
        total: inv.total,
        paid: totalPaid,
        outstanding,
        currency: inv.currency,
      });

      existing.totalOutstandingEgp = Number(
        (existing.totalOutstandingEgp + outstandingEgp).toFixed(2),
      );
      supplierMap.set(supplierId, existing);
    }

    const result: Array<{
      supplierId: number;
      supplierName: string;
      totalOutstanding: number;
      invoices: OutstandingInvoice[];
    }> = [];
    for (const [supplierId, val] of supplierMap.entries()) {
      result.push({
        supplierId,
        supplierName: val.name,
        totalOutstanding: val.totalOutstandingEgp, // in EGP
        invoices: val.invoices,
      });
    }

    return result;
  }

  // 5. Accounts Receivable Report
  async getAccountsReceivable(): Promise<
    Array<{
      customerName: string;
      totalOutstanding: number;
      invoices: Array<{
        id: number;
        number: string;
        date: Date | string;
        dueDate: Date | string;
        total: number;
        paid: number;
        outstanding: number;
        currency: string;
      }>;
    }>
  > {
    const invoices = await this.invoicesService.findAll();
    const payments = await this.paymentsService.findAll();

    const outgoing = invoices.filter(
      (inv) =>
        inv.type === InvoiceType.OUTGOING &&
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.CANCELLED,
    );

    const customerMap = new Map<
      string,
      { invoices: OutstandingInvoice[]; totalOutstandingEgp: number }
    >();

    for (const inv of outgoing) {
      const customerName = inv.customerName || 'Unknown Customer';

      // Sum payments for this invoice
      const invPayments = payments.filter((p) => p.invoiceId === inv.id);
      let totalPaid = 0;
      for (const p of invPayments) {
        if (p.currency.toUpperCase() === inv.currency.toUpperCase()) {
          totalPaid += p.amount;
        } else {
          const rate = await this.accountingService.getExchangeRate(
            p.currency,
            inv.currency,
            p.date,
          );
          totalPaid += p.amount * rate;
        }
      }
      totalPaid = Number(totalPaid.toFixed(2));
      const outstanding = Number((inv.total - totalPaid).toFixed(2));

      if (outstanding <= 0) continue;

      const existing = customerMap.get(customerName) || {
        invoices: [],
        totalOutstandingEgp: 0,
      };

      const rateToEgp = await this.accountingService.getExchangeRate(
        inv.currency,
        'EGP',
        inv.date,
      );
      const outstandingEgp = Number((outstanding * rateToEgp).toFixed(2));

      existing.invoices.push({
        id: inv.id,
        number: inv.number,
        date: inv.date,
        dueDate: inv.dueDate,
        total: inv.total,
        paid: totalPaid,
        outstanding,
        currency: inv.currency,
      });

      existing.totalOutstandingEgp = Number(
        (existing.totalOutstandingEgp + outstandingEgp).toFixed(2),
      );
      customerMap.set(customerName, existing);
    }

    const result: Array<{
      customerName: string;
      totalOutstanding: number;
      invoices: OutstandingInvoice[];
    }> = [];
    for (const [customerName, val] of customerMap.entries()) {
      result.push({
        customerName,
        totalOutstanding: val.totalOutstandingEgp, // in EGP
        invoices: val.invoices,
      });
    }

    return result;
  }
}
