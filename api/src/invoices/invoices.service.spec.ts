import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { AccountingService } from '../accounting/accounting.service';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  const mockInvoiceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockLineRepo = {
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockAccountingService = {
    findAllJournalEntries: jest.fn(),
    findAllAccounts: jest.fn(),
    createJournalEntry: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepo,
        },
        {
          provide: getRepositoryToken(InvoiceLine),
          useValue: mockLineRepo,
        },
        {
          provide: AccountingService,
          useValue: mockAccountingService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNextNumber', () => {
    it('should generate first sequence number if no invoices exist', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue(undefined);
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      const result = await service.generateNextNumber();

      const year = new Date().getFullYear();
      expect(result.number).toBe(`INV-${year}-0001`);
    });

    it('should increment sequence number based on existing invoice number', async () => {
      const year = new Date().getFullYear();
      mockQueryBuilder.getRawOne.mockResolvedValue({
        number: `INV-${year}-0005`,
      });
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      const result = await service.generateNextNumber();

      expect(result.number).toBe(`INV-${year}-0006`);
    });
  });

  describe('create', () => {
    it('should successfully create an invoice and generate journal entry if SENT', async () => {
      const dto = {
        number: 'INV-2026-0001',
        type: InvoiceType.OUTGOING,
        supplierId: undefined,
        customerName: 'Customer A',
        date: '2026-06-23',
        dueDate: '2026-07-23',
        status: InvoiceStatus.SENT,
        currency: 'USD',
        lines: [{ description: 'Item 1', quantity: 2, unitPrice: 50 }],
        tax: 10,
      };

      const mockLine = {
        id: 1,
        description: 'Item 1',
        quantity: 2,
        unitPrice: 50,
        total: 100,
      } as InvoiceLine;

      const mockSavedInvoice = {
        id: 10,
        number: 'INV-2026-0001',
        type: InvoiceType.OUTGOING,
        status: InvoiceStatus.SENT,
        currency: 'USD',
        date: new Date('2026-06-23'),
        dueDate: new Date('2026-07-23'),
        subtotal: 100,
        tax: 10,
        total: 110,
        lines: [mockLine],
      } as Invoice;

      mockInvoiceRepo.findOne.mockResolvedValue(null);
      mockLineRepo.create.mockReturnValue(mockLine);
      mockInvoiceRepo.create.mockReturnValue(mockSavedInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockSavedInvoice);

      mockAccountingService.findAllJournalEntries.mockResolvedValue([]);
      mockAccountingService.findAllAccounts.mockResolvedValue([
        { id: 101, code: '1200' },
        { id: 102, code: '4100' },
        { id: 103, code: '2200' },
      ]);

      const result = await service.create(dto);

      expect(mockInvoiceRepo.save).toHaveBeenCalled();
      expect(mockAccountingService.createJournalEntry).toHaveBeenCalled();
      expect(result).toEqual(mockSavedInvoice);
    });

    it('should throw BadRequestException if invoice number already exists', async () => {
      const dto = {
        number: 'INV-2026-0001',
        type: InvoiceType.OUTGOING,
        customerName: 'Customer A',
        date: '2026-06-23',
        dueDate: '2026-07-23',
        currency: 'USD',
        lines: [],
      };

      mockInvoiceRepo.findOne.mockResolvedValue({
        id: 1,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should successfully update basic properties and recreate lines', async () => {
      const mockInvoice = {
        id: 10,
        number: 'INV-2026-0001',
        type: InvoiceType.OUTGOING,
        status: InvoiceStatus.DRAFT,
        date: new Date('2026-06-23'),
        dueDate: new Date('2026-07-23'),
        lines: [{ id: 1 } as InvoiceLine],
        subtotal: 100,
        tax: 10,
        total: 110,
      } as Invoice;

      const dto = {
        status: InvoiceStatus.SENT,
        lines: [{ description: 'New Item', quantity: 1, unitPrice: 200 }],
        tax: 20,
      };

      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockLineRepo.delete.mockResolvedValue({
        raw: [],
        affected: 1,
      });
      mockLineRepo.create.mockReturnValue({ total: 200 });
      mockInvoiceRepo.save.mockImplementation((inv) => Promise.resolve(inv));

      mockAccountingService.findAllJournalEntries.mockResolvedValue([]);
      mockAccountingService.findAllAccounts.mockResolvedValue([
        { id: 101, code: '1200' },
        { id: 102, code: '4100' },
        { id: 103, code: '2200' },
      ]);

      const result = await service.update(10, dto);

      expect(mockLineRepo.delete).toHaveBeenCalledWith({ invoiceId: 10 });
      expect(result.status).toBe(InvoiceStatus.SENT);
      expect(result.total).toBe(220);
      expect(mockAccountingService.createJournalEntry).toHaveBeenCalled();
    });

    it('should throw NotFoundException if updating non-existing invoice', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all invoices with relations', async () => {
      const mockInvoices = [{ id: 1 } as Invoice];
      mockInvoiceRepo.find.mockResolvedValue(mockInvoices);

      const result = await service.findAll();

      expect(mockInvoiceRepo.find).toHaveBeenCalledWith({
        relations: { lines: true, supplier: true, purchaseOrder: true },
      });
      expect(result).toEqual(mockInvoices);
    });
  });

  describe('findOne', () => {
    it('should return an invoice if found', async () => {
      const mockInvoice = { id: 1 } as Invoice;
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);

      const result = await service.findOne(1);

      expect(mockInvoiceRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { lines: true, supplier: true, purchaseOrder: true },
      });
      expect(result).toEqual(mockInvoice);
    });

    it('should throw NotFoundException if invoice is not found', async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove invoice', async () => {
      const mockInvoice = { id: 1 } as Invoice;
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockInvoiceRepo.remove.mockResolvedValue(mockInvoice);

      await service.remove(1);

      expect(mockInvoiceRepo.remove).toHaveBeenCalledWith(mockInvoice);
    });
  });
});
