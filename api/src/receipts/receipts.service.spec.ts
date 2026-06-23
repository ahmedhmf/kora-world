import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptsService } from './receipts.service';
import { Receipt, ReceiptStatus } from './entities/receipt.entity';
import { ReceiptLineItem } from './entities/receipt-line-item.entity';
import { AccountsService } from '../accounts/accounts.service';
import { NotFoundException } from '@nestjs/common';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { Account } from '../accounts/entities/account.entity';

type MockRepository<T = unknown> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let receiptRepo: MockRepository<Receipt>;
  let lineItemRepo: MockRepository<ReceiptLineItem>;
  let accountsService: jest.Mocked<Partial<AccountsService>>;

  const mockAccount = {
    id: 1,
    companyName: 'Test Company',
    accountNumber: 'ACC-0001',
    defaultCurrency: 'USD',
    paymentTerms: 'Net 30',
  } as Account;

  const mockReceiptLineItem = {
    id: 10,
    receiptId: 5,
    productId: 1,
    articleNumber: 'ART-001',
    description: 'Line item description',
    quantity: 2,
    unitPrice: 50.0,
    discountPct: 10,
    lineTotal: 90.0,
  } as ReceiptLineItem;

  const mockReceipt = {
    id: 5,
    receiptNumber: 'RCP-20260623-1234',
    accountId: 1,
    status: ReceiptStatus.DRAFT,
    issueDate: new Date('2026-06-23'),
    dueDate: new Date('2026-07-23'),
    currency: 'USD',
    paymentTerms: 'Net 30',
    vatRate: 20,
    subtotal: 100,
    discountAmount: 10,
    taxAmount: 18,
    totalAmount: 108,
    notes: 'Test notes',
    createdAt: new Date(),
    updatedAt: new Date(),
    account: mockAccount,
    lineItems: [mockReceiptLineItem],
  } as Receipt;

  beforeEach(async () => {
    receiptRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((data) => ({ ...data } as Receipt)),
      save: jest.fn((receipt) => Promise.resolve({ id: 5, ...receipt } as Receipt)),
      remove: jest.fn(),
    };

    lineItemRepo = {
      create: jest.fn((data) => ({ id: 10, ...data } as ReceiptLineItem)),
    };

    accountsService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        {
          provide: getRepositoryToken(Receipt),
          useValue: receiptRepo,
        },
        {
          provide: getRepositoryToken(ReceiptLineItem),
          useValue: lineItemRepo,
        },
        {
          provide: AccountsService,
          useValue: accountsService,
        },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of receipts', async () => {
      receiptRepo.find?.mockResolvedValue([mockReceipt]);

      const result = await service.findAll();

      expect(receiptRepo.find).toHaveBeenCalledWith({
        relations: { account: true },
        order: { issueDate: 'DESC', createdAt: 'DESC' },
      });
      expect(result).toEqual([mockReceipt]);
    });
  });

  describe('findByAccount', () => {
    it('should return receipts for a specific account', async () => {
      receiptRepo.find?.mockResolvedValue([mockReceipt]);

      const result = await service.findByAccount(1);

      expect(receiptRepo.find).toHaveBeenCalledWith({
        where: { accountId: 1 },
        relations: { account: true },
        order: { issueDate: 'DESC' },
      });
      expect(result).toEqual([mockReceipt]);
    });
  });

  describe('findOne', () => {
    it('should return a receipt if found', async () => {
      receiptRepo.findOne?.mockResolvedValue(mockReceipt);

      const result = await service.findOne(5);

      expect(receiptRepo.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
        relations: {
          account: true,
          lineItems: { product: true },
        },
      });
      expect(result).toEqual(mockReceipt);
    });

    it('should throw NotFoundException if receipt not found', async () => {
      receiptRepo.findOne?.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto: CreateReceiptDto = {
      accountId: 1,
      issueDate: '2026-06-23',
      dueDate: '2026-07-23',
      currency: 'USD',
      paymentTerms: 'Net 30',
      vatRate: 20,
      notes: 'Test notes',
      lineItems: [
        {
          productId: 1,
          articleNumber: 'ART-001',
          description: 'Line item description',
          quantity: 2,
          unitPrice: 50.0,
          discountPct: 10,
        },
      ],
    };

    it('should successfully create and save a receipt', async () => {
      accountsService.findOne.mockResolvedValue(mockAccount);
      // Simulate that the first generated receipt number does not exist in DB
      receiptRepo.findOneBy?.mockResolvedValue(null);

      const result = await service.create(dto);

      expect(accountsService.findOne).toHaveBeenCalledWith(1);
      expect(receiptRepo.findOneBy).toHaveBeenCalledWith({ receiptNumber: expect.any(String) });
      expect(lineItemRepo.create).toHaveBeenCalledWith({
        productId: 1,
        articleNumber: 'ART-001',
        description: 'Line item description',
        quantity: 2,
        unitPrice: 50.0,
        discountPct: 10,
        lineTotal: 90.0, // (50 * 2) - 10% discount
      });
      expect(receiptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          status: ReceiptStatus.DRAFT,
          currency: 'USD',
          paymentTerms: 'Net 30',
          vatRate: 20,
          subtotal: 100, // 2 * 50
          discountAmount: 10, // 10% of 100
          taxAmount: 18, // 20% of 90
          totalAmount: 108, // 90 + 18
          notes: 'Test notes',
        }),
      );
      expect(receiptRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(5);
    });

    it('should retry generating receipt number if conflict is found', async () => {
      accountsService.findOne.mockResolvedValue(mockAccount);
      // First try returns an existing receipt, second try returns null (meaning it is free)
      receiptRepo.findOneBy?.mockResolvedValueOnce(mockReceipt).mockResolvedValueOnce(null);

      const result = await service.create(dto);

      expect(receiptRepo.findOneBy).toHaveBeenCalledTimes(2);
      expect(receiptRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(5);
    });

    it('should fallback to account default currency, paymentTerms, and 0 vatRate if not provided in dto', async () => {
      accountsService.findOne.mockResolvedValue({
        ...mockAccount,
        defaultCurrency: 'EUR',
        paymentTerms: 'Net 15',
      } as Account);
      receiptRepo.findOneBy?.mockResolvedValue(null);

      const minimalDto: CreateReceiptDto = {
        accountId: 1,
        issueDate: '2026-06-23',
        lineItems: [
          {
            articleNumber: 'ART-002',
            description: 'Simple Line',
            quantity: 1,
            unitPrice: 100,
          },
        ],
      };

      await service.create(minimalDto);

      expect(receiptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'EUR',
          paymentTerms: 'Net 15',
          vatRate: 0,
          subtotal: 100,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: 100,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update and save receipt properties', async () => {
      receiptRepo.findOne?.mockResolvedValue({ ...mockReceipt });

      const updateDto: UpdateReceiptDto = {
        status: ReceiptStatus.PAID,
        dueDate: '2026-08-01',
        paymentTerms: 'Cash',
        notes: 'Updated notes',
      };

      const result = await service.update(5, updateDto);

      expect(receiptRepo.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
        relations: {
          account: true,
          lineItems: { product: true },
        },
      });
      expect(receiptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          status: ReceiptStatus.PAID,
          dueDate: new Date('2026-08-01'),
          paymentTerms: 'Cash',
          notes: 'Updated notes',
        }),
      );
      expect(result.id).toBe(5);
    });

    it('should not overwrite properties that are not passed in update DTO', async () => {
      const originalReceipt = { ...mockReceipt };
      receiptRepo.findOne?.mockResolvedValue(originalReceipt);

      await service.update(5, {});

      expect(receiptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          status: mockReceipt.status,
          dueDate: mockReceipt.dueDate,
          paymentTerms: mockReceipt.paymentTerms,
          notes: mockReceipt.notes,
        }),
      );
    });

    it('should throw NotFoundException if trying to update non-existent receipt', async () => {
      receiptRepo.findOne?.mockResolvedValue(null);

      await expect(service.update(999, { status: ReceiptStatus.ISSUED })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove receipt if found', async () => {
      receiptRepo.findOne?.mockResolvedValue(mockReceipt);
      receiptRepo.remove?.mockResolvedValue(mockReceipt);

      await service.remove(5);

      expect(receiptRepo.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
        relations: {
          account: true,
          lineItems: { product: true },
        },
      });
      expect(receiptRepo.remove).toHaveBeenCalledWith(mockReceipt);
    });

    it('should throw NotFoundException if receipt to remove is not found', async () => {
      receiptRepo.findOne?.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
