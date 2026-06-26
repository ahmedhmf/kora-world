import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;

  const mockAccountRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: mockAccountRepo,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return an array of accounts ordered by companyName', async () => {
      const mockAccounts = [
        { id: 1, companyName: 'Acme Corp' },
        { id: 2, companyName: 'Beta Ltd' },
      ] as Account[];

      mockAccountRepo.find.mockResolvedValue(mockAccounts);

      const result = await service.findAll();

      expect(result).toEqual(mockAccounts);
      expect(mockAccountRepo.find).toHaveBeenCalledWith({
        relations: { assignedSalesRep: true },
        order: { companyName: 'ASC' },
      });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the account when found', async () => {
      const mockAccount = { id: 1, companyName: 'Acme Corp' } as Account;
      mockAccountRepo.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOne(1);

      expect(result).toEqual(mockAccount);
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { assignedSalesRep: true },
      });
    });

    it('should throw NotFoundException when account is not found', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── generateNextAccountNumber ───────────────────────────────────────────────

  describe('generateNextAccountNumber', () => {
    it('should return ACC-0001 when no accounts exist', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      const result = await service.generateNextAccountNumber();

      expect(result).toBe('ACC-0001');
    });

    it('should increment the counter based on the last account number', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 5,
        accountNumber: 'ACC-0005',
      } as Account);

      const result = await service.generateNextAccountNumber();

      expect(result).toBe('ACC-0006');
    });

    it('should return ACC-0001 when last account has no parsable account number', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 1,
        accountNumber: null,
      } as Account);

      const result = await service.generateNextAccountNumber();

      expect(result).toBe('ACC-0001');
    });

    it('should return ACC-0001 when last accountNumber has unexpected format', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 1,
        accountNumber: 'INVALID',
      } as Account);

      const result = await service.generateNextAccountNumber();

      expect(result).toBe('ACC-0001');
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should assign an account number and save the new account', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null); // no existing accounts
      const dto: CreateAccountDto = { companyName: 'New Corp' } as CreateAccountDto;
      const created = { id: 1, companyName: 'New Corp', accountNumber: 'ACC-0001' } as Account;

      mockAccountRepo.create.mockReturnValue(created);
      mockAccountRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockAccountRepo.create).toHaveBeenCalledWith({
        ...dto,
        accountNumber: 'ACC-0001',
      });
      expect(mockAccountRepo.save).toHaveBeenCalledWith(created);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update fields on the account and save', async () => {
      const existingAccount = { id: 1, companyName: 'Old Corp' } as Account;
      mockAccountRepo.findOne.mockResolvedValue(existingAccount);
      mockAccountRepo.save.mockImplementation((val: Account) => Promise.resolve(val));

      const dto: UpdateAccountDto = { companyName: 'New Corp' } as UpdateAccountDto;
      const result = await service.update(1, dto);

      expect(result.companyName).toBe('New Corp');
      expect(mockAccountRepo.save).toHaveBeenCalledWith(existingAccount);
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { companyName: 'X' } as UpdateAccountDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove the account when found', async () => {
      const mockAccount = { id: 1, companyName: 'Acme' } as Account;
      mockAccountRepo.findOne.mockResolvedValue(mockAccount);
      mockAccountRepo.remove.mockResolvedValue(mockAccount);

      await service.remove(1);

      expect(mockAccountRepo.remove).toHaveBeenCalledWith(mockAccount);
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
