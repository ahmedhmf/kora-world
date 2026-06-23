import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalService } from './journal.service';
import { AccountingService } from './accounting.service';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry, JournalEntryType } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { NotFoundException } from '@nestjs/common';

describe('JournalService', () => {
  let service: JournalService;
  let accountingService: jest.Mocked<AccountingService>;
  let accountRepo: jest.Mocked<Repository<AccountingAccount>>;
  let entryRepo: jest.Mocked<Repository<JournalEntry>>;
  let lineRepo: jest.Mocked<Repository<JournalLine>>;

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: AccountingService,
          useValue: {
            createJournalEntry: jest.fn(),
            findAllAccounts: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccountingAccount),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            findOne: jest.fn(),
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

    service = module.get<JournalService>(JournalService);
    accountingService = module.get(AccountingService) as any;
    accountRepo = module.get(getRepositoryToken(AccountingAccount));
    entryRepo = module.get(getRepositoryToken(JournalEntry));
    lineRepo = module.get(getRepositoryToken(JournalLine));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createManualEntry', () => {
    it('should delegate to accountingService.createJournalEntry', async () => {
      const dto = { date: '2026-06-23', description: 'Test', type: JournalEntryType.MANUAL, lines: [] };
      accountingService.createJournalEntry.mockResolvedValueOnce({ id: 1 } as JournalEntry);

      const res = await service.createManualEntry(dto);
      expect(accountingService.createJournalEntry).toHaveBeenCalledWith(dto);
      expect(res.id).toBe(1);
    });
  });

  describe('createPOPaymentEntry', () => {
    it('should throw NotFoundException if bank account does not exist', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createPOPaymentEntry(1, 1000, 'EUR', 30, 99),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if Accounts Payable (code 2100) not found', async () => {
      const bankAccount = { id: 2, code: '1100' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(bankAccount);
      accountingService.findAllAccounts.mockResolvedValueOnce([]);

      await expect(
        service.createPOPaymentEntry(1, 1000, 'EUR', 30, 2),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully create PO Payment entry', async () => {
      const bankAccount = { id: 2, code: '1100' } as AccountingAccount;
      const apAccount = { id: 5, code: '2100' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(bankAccount);
      accountingService.findAllAccounts.mockResolvedValueOnce([apAccount]);
      accountingService.createJournalEntry.mockResolvedValueOnce({ id: 100 } as JournalEntry);

      const result = await service.createPOPaymentEntry(1, 1000, 'EUR', 30, 2);
      expect(result.id).toBe(100);
      expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Payment for Purchase Order #1',
          reference: 'PO-PAY-1',
          type: JournalEntryType.PAYMENT,
          poId: 1,
          lines: [
            { accountId: 5, debit: 1000, currency: 'EUR', exchangeRate: 30 },
            { accountId: 2, credit: 1000, currency: 'EUR', exchangeRate: 30 },
          ],
        }),
      );
    });
  });

  describe('createPOReceiptEntry', () => {
    it('should throw NotFoundException if Inventory (1300) or Accounts Payable (2100) is missing', async () => {
      accountingService.findAllAccounts.mockResolvedValueOnce([]);
      await expect(
        service.createPOReceiptEntry(1, 1000, 'EUR', 30),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully create PO Receipt entry', async () => {
      const invAccount = { id: 4, code: '1300' } as AccountingAccount;
      const apAccount = { id: 5, code: '2100' } as AccountingAccount;
      accountingService.findAllAccounts.mockResolvedValueOnce([invAccount, apAccount]);
      accountingService.createJournalEntry.mockResolvedValueOnce({ id: 200 } as JournalEntry);

      const result = await service.createPOReceiptEntry(1, 1000, 'EUR', 30);
      expect(result.id).toBe(200);
      expect(accountingService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Receipt for Purchase Order #1',
          reference: 'PO-REC-1',
          type: JournalEntryType.PO,
          poId: 1,
          lines: [
            { accountId: 4, debit: 1000, currency: 'EUR', exchangeRate: 30 },
            { accountId: 5, credit: 1000, currency: 'EUR', exchangeRate: 30 },
          ],
        }),
      );
    });
  });

  describe('getAccountBalance', () => {
    it('should throw NotFoundException if account not found', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getAccountBalance(99)).rejects.toThrow(NotFoundException);
    });

    it('should correctly calculate debit, credit, rawBalance, and balance for assets (debit normal)', async () => {
      const acc = { id: 1, code: '1000', type: AccountType.ASSET } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(acc);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalDebit: '150.50',
        totalCredit: '50.00',
      });

      const res = await service.getAccountBalance(1, '2026-01-01', '2026-12-31');
      expect(res.totalDebit).toBe(150.50);
      expect(res.totalCredit).toBe(50.00);
      expect(res.rawBalance).toBe(100.50);
      expect(res.balance).toBe(100.50);
    });

    it('should correctly calculate liability balance (credit normal)', async () => {
      const acc = { id: 2, code: '2100', type: AccountType.LIABILITY } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(acc);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalDebit: '50.00',
        totalCredit: '150.50',
      });

      const res = await service.getAccountBalance(2);
      expect(res.rawBalance).toBe(-100.50);
      expect(res.balance).toBe(100.50); // normal credit balance is credit - debit
    });
  });

  describe('getLedger', () => {
    it('should throw NotFoundException if account not found', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getLedger(99)).rejects.toThrow(NotFoundException);
    });

    it('should construct ledger including opening balance and running balances', async () => {
      const acc = { id: 1, code: '1000' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(acc);

      // Prior lines query (to compute opening balance if startDate provided)
      const priorLine = { debit: 100, credit: 20 } as JournalLine;
      mockQueryBuilder.getMany.mockResolvedValueOnce([priorLine]); // opening balance calculation call

      // Current lines query
      const currentLines = [
        {
          id: 10,
          debit: 50,
          credit: 0,
          currency: 'EGP',
          exchangeRate: 1,
          amountBase: 50,
          amountEgp: 50,
          journalEntry: { date: '2026-06-23', description: 'Entry 1', reference: 'REF-1' },
        },
      ] as any[];
      mockQueryBuilder.getMany.mockResolvedValueOnce(currentLines);

      const res = await service.getLedger(1, '2026-06-01', '2026-06-30');
      expect(res.account).toEqual(acc);
      expect(res.lines).toHaveLength(1);
      expect(res.lines[0].runningBalance).toBe(130); // 80 (opening) + 50 (debit)
    });
  });
});
