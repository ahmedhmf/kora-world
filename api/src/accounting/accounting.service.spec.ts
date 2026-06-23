import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingService } from './accounting.service';
import { AccountingAccount, AccountType } from './entities/accounting-account.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AccountingService', () => {
  let service: AccountingService;
  let accountRepo: jest.Mocked<Repository<AccountingAccount>>;
  let entryRepo: jest.Mocked<Repository<JournalEntry>>;
  let lineRepo: jest.Mocked<Repository<JournalLine>>;
  let rateRepo: jest.Mocked<Repository<ExchangeRate>>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        {
          provide: getRepositoryToken(AccountingAccount),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            merge: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalLine),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ExchangeRate),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<AccountingService>(AccountingService);
    accountRepo = module.get(getRepositoryToken(AccountingAccount));
    entryRepo = module.get(getRepositoryToken(JournalEntry));
    lineRepo = module.get(getRepositoryToken(JournalLine));
    rateRepo = module.get(getRepositoryToken(ExchangeRate));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should throw BadRequestException if account code already exists', async () => {
      accountRepo.findOne.mockResolvedValueOnce({ id: 1, code: '1000' } as AccountingAccount);
      await expect(
        service.createAccount({ code: '1000', name: 'Cash', type: AccountType.ASSET }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if parentId is provided but not found', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null); // existing check
      accountRepo.findOne.mockResolvedValueOnce(null); // parent check
      await expect(
        service.createAccount({ code: '1000', name: 'Cash', type: AccountType.ASSET, parentId: 99 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and save account successfully', async () => {
      const dto = { code: '1001', name: 'Petty Cash', type: AccountType.ASSET, parentId: 1 };
      const parentAcc = { id: 1, code: '1000', name: 'Cash' } as AccountingAccount;
      const newAcc = { id: 2, ...dto, parent: parentAcc } as any;

      accountRepo.findOne.mockResolvedValueOnce(null); // existing
      accountRepo.findOne.mockResolvedValueOnce(parentAcc); // parent
      accountRepo.create.mockReturnValueOnce(newAcc);
      accountRepo.save.mockResolvedValueOnce(newAcc);

      const result = await service.createAccount(dto);
      expect(result).toEqual(newAcc);
      expect(accountRepo.save).toHaveBeenCalledWith(newAcc);
    });
  });

  describe('updateAccount', () => {
    it('should throw NotFoundException if account to update does not exist', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateAccount(99, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if code is updated to an existing code', async () => {
      const existingAcc = { id: 1, code: '1000', name: 'Cash' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(existingAcc); // account to update
      accountRepo.findOne.mockResolvedValueOnce({ id: 2, code: '2000' } as AccountingAccount); // code check

      await expect(
        service.updateAccount(1, { code: '2000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully clear parent if parentId is null', async () => {
      const existingAcc = { id: 2, code: '1001', parentId: 1, parent: {} } as any;
      accountRepo.findOne.mockResolvedValueOnce(existingAcc);
      accountRepo.save.mockResolvedValueOnce(existingAcc);

      const result = await service.updateAccount(2, { parentId: null });
      expect(result.parent).toBeNull();
      expect(result.parentId).toBeNull();
    });

    it('should update parent and merge changes successfully', async () => {
      const existingAcc = { id: 2, code: '1001', parentId: 1 } as any;
      const parentAcc = { id: 3, code: '1000' } as any;
      accountRepo.findOne.mockResolvedValueOnce(existingAcc);
      accountRepo.findOne.mockResolvedValueOnce(parentAcc);
      accountRepo.save.mockResolvedValueOnce(existingAcc);

      await service.updateAccount(2, { parentId: 3, name: 'Updated Name' });
      expect(accountRepo.merge).toHaveBeenCalledWith(existingAcc, {
        code: undefined,
        name: 'Updated Name',
        type: undefined,
        currency: undefined,
        isActive: undefined,
      });
      expect(accountRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAllAccounts', () => {
    it('should query accounts with type and codes filter', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);
      await service.findAllAccounts('asset', '1000, 2000');
      expect(accountRepo.createQueryBuilder).toHaveBeenCalledWith('account');
    });
  });

  describe('findAccountTree', () => {
    it('should return hierarchical structure of accounts', async () => {
      const list = [
        { id: 1, name: 'Assets', parentId: null },
        { id: 2, name: 'Cash', parentId: 1 },
      ] as AccountingAccount[];
      accountRepo.find.mockResolvedValueOnce(list);

      const tree = await service.findAccountTree();
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(1);
      expect((tree[0] as any).children).toHaveLength(1);
      expect((tree[0] as any).children[0].id).toBe(2);
    });
  });

  describe('findAccountById', () => {
    it('should return account if found', async () => {
      const acc = { id: 1, name: 'Cash' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(acc);
      const res = await service.findAccountById(1);
      expect(res).toEqual(acc);
    });

    it('should throw NotFoundException if not found', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findAccountById(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createExchangeRate', () => {
    it('should create and save rate', async () => {
      const dto = { fromCurrency: 'usd', toCurrency: 'egp', rate: 50, date: '2026-06-23' };
      rateRepo.create.mockReturnValueOnce(dto as any);
      rateRepo.save.mockResolvedValueOnce(dto as any);
      const res = await service.createExchangeRate(dto);
      expect(res).toEqual(dto);
    });
  });

  describe('getExchangeRate', () => {
    it('should return 1.0 if currencies are the same', async () => {
      const res = await service.getExchangeRate('USD', 'usd', '2026-06-23');
      expect(res).toBe(1.0);
    });

    it('should throw BadRequestException if direct and inverse rates not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      await expect(service.getExchangeRate('USD', 'EGP', '2026-06-23')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createJournalEntry', () => {
    it('should throw NotFoundException if an account in a line is not found', async () => {
      accountRepo.findOne.mockResolvedValueOnce(null);
      const dto = {
        date: '2026-06-23',
        description: 'Test',
        type: 'manual' as any,
        lines: [{ accountId: 99, debit: 100, credit: 0, currency: 'EGP' }],
      };
      await expect(service.createJournalEntry(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if journal entry is unbalanced', async () => {
      const acc1 = { id: 1, code: '1000' } as AccountingAccount;
      const acc2 = { id: 2, code: '2000' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(acc1).mockResolvedValueOnce(acc2);

      const dto = {
        date: '2026-06-23',
        description: 'Test',
        type: 'manual' as any,
        lines: [
          { accountId: 1, debit: 100, credit: 0, currency: 'EGP', exchangeRate: 1.0 },
          { accountId: 2, debit: 0, credit: 90, currency: 'EGP', exchangeRate: 1.0 },
        ],
      };

      await expect(service.createJournalEntry(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create and balance a journal entry and adjust for tiny rounding difference', async () => {
      const acc1 = { id: 1, code: '1000' } as AccountingAccount;
      const acc2 = { id: 2, code: '2000' } as AccountingAccount;
      accountRepo.findOne.mockResolvedValueOnce(acc1).mockResolvedValueOnce(acc2);

      const dto = {
        date: '2026-06-23',
        description: 'Test',
        type: 'manual' as any,
        lines: [
          { accountId: 1, debit: 100.01, credit: 0, currency: 'EGP', exchangeRate: 1.0 },
          { accountId: 2, debit: 0, credit: 100.00, currency: 'EGP', exchangeRate: 1.0 },
        ],
      };

      const mockEntry = { id: 10, lines: [] } as any;
      entryRepo.create.mockReturnValueOnce(mockEntry);
      entryRepo.save.mockResolvedValueOnce(mockEntry);
      lineRepo.create.mockImplementation((obj) => obj as any);

      await service.createJournalEntry(dto);

      expect(entryRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAllJournalEntries', () => {
    it('should return list of entries', async () => {
      entryRepo.find.mockResolvedValueOnce([]);
      const res = await service.findAllJournalEntries();
      expect(res).toEqual([]);
    });
  });

  describe('findJournalEntryById', () => {
    it('should return entry if found', async () => {
      entryRepo.findOne.mockResolvedValueOnce({ id: 1 } as JournalEntry);
      const res = await service.findJournalEntryById(1);
      expect(res.id).toBe(1);
    });

    it('should throw NotFoundException if not found', async () => {
      entryRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findJournalEntryById(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteJournalEntryByReference', () => {
    it('should remove entry if found', async () => {
      const entry = { id: 1, reference: 'REF' } as JournalEntry;
      entryRepo.findOne.mockResolvedValueOnce(entry);
      await service.deleteJournalEntryByReference('REF');
      expect(entryRepo.remove).toHaveBeenCalledWith(entry);
    });

    it('should not call remove if not found', async () => {
      entryRepo.findOne.mockResolvedValueOnce(null);
      await service.deleteJournalEntryByReference('REF');
      expect(entryRepo.remove).not.toHaveBeenCalled();
    });
  });
});
