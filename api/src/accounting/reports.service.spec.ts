import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportsService } from './reports.service';
import { AccountingService } from './accounting.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalLine } from './entities/journal-line.entity';
import { InvoiceType, InvoiceStatus } from '../invoices/entities/invoice.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let accountingService: jest.Mocked<AccountingService>;
  let invoicesService: jest.Mocked<InvoicesService>;
  let paymentsService: jest.Mocked<PaymentsService>;
  let accountRepo: jest.Mocked<Repository<AccountingAccount>>;
  let lineRepo: jest.Mocked<Repository<JournalLine>>;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: AccountingService,
          useValue: {
            getExchangeRate: jest.fn(),
          },
        },
        {
          provide: InvoicesService,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccountingAccount),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalLine),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    accountingService = module.get(AccountingService) as any;
    invoicesService = module.get(InvoicesService) as any;
    paymentsService = module.get(PaymentsService) as any;
    accountRepo = module.get(getRepositoryToken(AccountingAccount));
    lineRepo = module.get(getRepositoryToken(JournalLine));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfitAndLoss', () => {
    it('should calculate revenue, expense, gross profit, and net profit in EGP', async () => {
      const mockLines = [
        {
          amountBase: -1000, // Negative for credits (Revenue)
          account: { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE },
          journalEntry: { date: '2026-06-15' },
        },
        {
          amountBase: 400, // Positive for debits (COGS Expense starting with 51)
          account: { code: '5100', name: 'Cost of Goods Sold', type: AccountType.EXPENSE },
          journalEntry: { date: '2026-06-15' },
        },
        {
          amountBase: 100, // Other Expense
          account: { code: '5200', name: 'Rent', type: AccountType.EXPENSE },
          journalEntry: { date: '2026-06-15' },
        },
      ] as JournalLine[];

      mockQueryBuilder.getMany.mockResolvedValueOnce(mockLines);

      const result = await service.getProfitAndLoss('2026-06-01', '2026-06-30', 'EGP');

      expect(result.revenue).toEqual([{ code: '4000', name: 'Sales Revenue', amount: 1000 }]);
      expect(result.expenses).toEqual([
        { code: '5100', name: 'Cost of Goods Sold', amount: 400 },
        { code: '5200', name: 'Rent', amount: 100 },
      ]);
      expect(result.grossProfit).toBe(600); // 1000 - 400
      expect(result.netProfit).toBe(500); // 1000 - 500
      expect(result.currency).toBe('EGP');
    });

    it('should convert to target currency if target currency is not EGP', async () => {
      const mockLines = [
        {
          amountBase: -1000,
          account: { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE },
          journalEntry: { date: '2026-06-15' },
        },
      ] as JournalLine[];
      mockQueryBuilder.getMany.mockResolvedValueOnce(mockLines);
      accountingService.getExchangeRate.mockResolvedValueOnce(0.02); // 1 EGP = 0.02 USD

      const result = await service.getProfitAndLoss('2026-06-01', '2026-06-30', 'USD');
      expect(result.revenue[0].amount).toBe(20);
      expect(result.currency).toBe('USD');
    });
  });

  describe('getBalanceSheet', () => {
    it('should generate assets, liabilities, equity lists and verify balancing', async () => {
      const mockAccounts = [
        { id: 1, code: '1000', name: 'Cash', type: AccountType.ASSET, isActive: true },
        { id: 2, code: '2100', name: 'Accounts Payable', type: AccountType.LIABILITY, isActive: true },
        { id: 3, code: '3000', name: 'Retained Earnings', type: AccountType.EQUITY, isActive: true },
      ] as AccountingAccount[];

      const mockLineBalances = [
        { accountId: '1', totalAmountBase: '1000.00' }, // Asset Debit = 1000
        { accountId: '2', totalAmountBase: '-600.00' },  // Liability Credit = 600
        { id: 3, accountId: '3', totalAmountBase: '-400.00' },  // Equity Credit = 400
      ] as any[];

      accountRepo.find.mockResolvedValueOnce(mockAccounts);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockLineBalances);

      const result = await service.getBalanceSheet('2026-06-23');
      expect(result.totalAssets).toBe(1000);
      expect(result.totalLiabilities).toBe(600);
      expect(result.totalEquity).toBe(400);
      expect(result.isBalanced).toBe(true);
      expect(result.difference).toBe(0);
    });
  });

  describe('getCashFlow', () => {
    it('should correctly format monthly cash inflows and outflows', async () => {
      const mockLines = [
        {
          debit: 500,
          credit: 0,
          account: { code: '1101' },
          journalEntry: { date: '2026-06-15' },
        },
        {
          debit: 0,
          credit: 200,
          account: { code: '1102' },
          journalEntry: { date: '2026-06-20' },
        },
      ] as JournalLine[];

      mockQueryBuilder.getMany.mockResolvedValueOnce(mockLines);

      const result = await service.getCashFlow('2026-06-01', '2026-06-30');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        period: '2026-06',
        inflows: 500,
        outflows: 200,
        netChange: 300,
      });
    });
  });

  describe('getAccountsPayable', () => {
    it('should aggregate AP per supplier', async () => {
      const invoices = [
        {
          id: 1,
          type: InvoiceType.INCOMING,
          status: InvoiceStatus.UNPAID,
          supplierId: 10,
          supplier: { name: 'Supplier A' },
          total: 1000,
          currency: 'EUR',
          date: '2026-06-01',
          dueDate: '2026-06-30',
          number: 'INV-001',
        },
      ] as any[];

      const payments = [
        {
          invoiceId: 1,
          amount: 200,
          currency: 'EUR',
          date: '2026-06-10',
        },
      ] as any[];

      invoicesService.findAll.mockResolvedValueOnce(invoices);
      paymentsService.findAll.mockResolvedValueOnce(payments);
      // Mock exchange rate from EUR to EGP
      accountingService.getExchangeRate.mockResolvedValue(30);

      const result = await service.getAccountsPayable();
      expect(result).toHaveLength(1);
      expect(result[0].supplierName).toBe('Supplier A');
      expect(result[0].invoices[0].outstanding).toBe(800); // 1000 - 200
      expect(result[0].totalOutstanding).toBe(24000); // 800 * 30 EGP
    });
  });

  describe('getAccountsReceivable', () => {
    it('should aggregate AR per customer', async () => {
      const invoices = [
        {
          id: 2,
          type: InvoiceType.OUTGOING,
          status: InvoiceStatus.PARTIALLY_PAID,
          customerName: 'Customer X',
          total: 500,
          currency: 'EGP',
          date: '2026-06-01',
          dueDate: '2026-06-30',
          number: 'INV-002',
        },
      ] as any[];

      const payments = [] as any[];

      invoicesService.findAll.mockResolvedValueOnce(invoices);
      paymentsService.findAll.mockResolvedValueOnce(payments);
      accountingService.getExchangeRate.mockResolvedValue(1.0);

      const result = await service.getAccountsReceivable();
      expect(result).toHaveLength(1);
      expect(result[0].customerName).toBe('Customer X');
      expect(result[0].invoices[0].outstanding).toBe(500);
      expect(result[0].totalOutstanding).toBe(500);
    });
  });
});
