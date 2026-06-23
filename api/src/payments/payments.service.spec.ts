import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { AccountingService } from '../accounting/accounting.service';
import { Invoice, InvoiceStatus } from '../invoices/entities/invoice.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPaymentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockInvoicesService = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockAccountingService = {
    getExchangeRate: jest.fn(),
    createJournalEntry: jest.fn(),
    deleteJournalEntryByReference: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
        {
          provide: AccountingService,
          useValue: mockAccountingService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a payment and update invoice status', async () => {
      const dto = {
        invoiceId: 10,
        date: '2026-06-23',
        amount: 100,
        currency: 'USD',
        exchangeRate: 1.5,
        method: 'wire_transfer',
        reference: 'REF-1',
        paidFromAccountId: 101,
        categoryAccountId: 102,
      };

      const mockInvoice = {
        id: 10,
        currency: 'USD',
        total: 100,
        status: InvoiceStatus.SENT,
      } as Invoice;

      const mockPayment = {
        id: 1,
        invoiceId: 10,
        amount: 100,
        currency: 'USD',
        exchangeRate: 1.5,
        reference: 'REF-1',
        categoryAccountId: 102,
        paidFromAccountId: 101,
        date: new Date('2026-06-23'),
      } as Payment;

      mockInvoicesService.findOne.mockResolvedValue(mockInvoice);
      mockPaymentRepo.create.mockReturnValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);
      mockPaymentRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.create(dto);

      expect(mockInvoicesService.findOne).toHaveBeenCalledWith(10);
      expect(mockPaymentRepo.save).toHaveBeenCalled();
      expect(mockInvoicesService.update).toHaveBeenCalledWith(10, {
        status: InvoiceStatus.PAID,
      });
      expect(mockAccountingService.createJournalEntry).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if invoiceId is provided but not found', async () => {
      const dto = {
        invoiceId: 999,
        date: '2026-06-23',
        amount: 100,
        currency: 'USD',
        method: 'wire_transfer',
        reference: 'REF-1',
        paidFromAccountId: 101,
        categoryAccountId: 102,
      };

      mockInvoicesService.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if categoryAccountId or paidFromAccountId is missing', async () => {
      const dto = {
        date: '2026-06-23',
        amount: 100,
        currency: 'USD',
        method: 'wire_transfer',
        reference: 'REF-1',
      };

      const mockPayment = {
        id: 1,
        amount: 100,
        currency: 'USD',
        date: new Date('2026-06-23'),
      } as Payment;

      mockPaymentRepo.create.mockReturnValue(mockPayment);
      mockPaymentRepo.save.mockResolvedValue(mockPayment);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      const mockPayments = [{ id: 1 } as Payment];
      mockPaymentRepo.find.mockResolvedValue(mockPayments);

      const result = await service.findAll();

      expect(mockPaymentRepo.find).toHaveBeenCalledWith({
        relations: { invoice: true },
      });
      expect(result).toEqual(mockPayments);
    });
  });

  describe('findOne', () => {
    it('should return a payment if found', async () => {
      const mockPayment = { id: 1 } as Payment;
      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne(1);

      expect(mockPaymentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { invoice: true },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment is not found', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should successfully remove a payment, delete journal entry, and recalculate invoice status', async () => {
      const mockPayment = {
        id: 1,
        invoiceId: 10,
        reference: 'REF-1',
        amount: 100,
        currency: 'USD',
      } as Payment;

      const mockInvoice = {
        id: 10,
        currency: 'USD',
        total: 100,
      } as Invoice;

      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice);
      mockPaymentRepo.find.mockResolvedValue([]);

      await service.remove(1);

      expect(mockPaymentRepo.remove).toHaveBeenCalledWith(mockPayment);
      expect(
        mockAccountingService.deleteJournalEntryByReference,
      ).toHaveBeenCalledWith('REF-1');
      expect(mockInvoicesService.update).toHaveBeenCalledWith(10, {
        status: InvoiceStatus.SENT,
      });
    });
  });
});
