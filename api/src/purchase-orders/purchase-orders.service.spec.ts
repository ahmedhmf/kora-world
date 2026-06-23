import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder, POStatus } from './entities/purchase-order.entity';
import { PurchaseOrderLineItem } from './entities/purchase-order-line-item.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ProductsService } from '../products/products.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  const mockPoRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockLineItemRepo = {
    create: jest.fn(),
  };

  const mockSuppliersService = {
    findOne: jest.fn(),
  };

  const mockProductsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPoRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderLineItem),
          useValue: mockLineItemRepo,
        },
        {
          provide: SuppliersService,
          useValue: mockSuppliersService,
        },
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all purchase orders filtered by supplierId if provided', async () => {
      const mockPos = [{ id: 1, poNumber: 'PO-1' } as PurchaseOrder];
      mockPoRepo.find.mockResolvedValue(mockPos);

      const result = await service.findAll(2);

      expect(mockPoRepo.find).toHaveBeenCalledWith({
        where: { supplierId: 2 },
        relations: { supplier: true },
        order: { orderDate: 'DESC', createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPos);
    });

    it('should return all purchase orders without filtering if supplierId not provided', async () => {
      const mockPos = [{ id: 1, poNumber: 'PO-1' } as PurchaseOrder];
      mockPoRepo.find.mockResolvedValue(mockPos);

      const result = await service.findAll();

      expect(mockPoRepo.find).toHaveBeenCalledWith({
        where: {},
        relations: { supplier: true },
        order: { orderDate: 'DESC', createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPos);
    });
  });

  describe('findOne', () => {
    it('should return a purchase order if found', async () => {
      const mockPo = { id: 1, poNumber: 'PO-1' } as PurchaseOrder;
      mockPoRepo.findOne.mockResolvedValue(mockPo);

      const result = await service.findOne(1);

      expect(mockPoRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: {
          supplier: { contacts: true },
          lineItems: { product: true },
        },
      });
      expect(result).toEqual(mockPo);
    });

    it('should throw NotFoundException if purchase order not found', async () => {
      mockPoRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should successfully create a purchase order', async () => {
      const dto = {
        supplierId: 1,
        orderDate: '2026-06-23',
        status: POStatus.DRAFT,
        lineItems: [{ productId: 10, quantity: 5 }],
      };

      const mockSupplier = {
        id: 1,
        name: 'Test Supplier',
        shippingRatePerKg: '2.5',
        leadTimeDays: 5,
        currency: 'USD',
      };

      const mockProduct = {
        id: 10,
        name: 'Test Product',
        supplierId: 1,
        unitPrice: '10.00',
        weightKg: 2,
        articleNumber: 'ART-10',
      };

      const mockLineItem = {
        productId: 10,
        articleNumber: 'ART-10',
        description: 'Test Product',
        quantity: 5,
        unitPrice: '10.00',
        lineTotal: 50,
      } as PurchaseOrderLineItem;

      const mockCreatedPo = {
        id: 100,
        supplierId: 1,
        status: POStatus.DRAFT,
      } as PurchaseOrder;

      mockSuppliersService.findOne.mockResolvedValue(mockSupplier);
      mockPoRepo.findOneBy.mockResolvedValue(null);
      mockProductsService.findOne.mockResolvedValue(mockProduct);
      mockLineItemRepo.create.mockReturnValue(mockLineItem);
      mockPoRepo.create.mockReturnValue(mockCreatedPo);
      mockPoRepo.save.mockResolvedValue(mockCreatedPo);

      const result = await service.create(dto);

      expect(mockSuppliersService.findOne).toHaveBeenCalledWith(1);
      expect(mockProductsService.findOne).toHaveBeenCalledWith(10);
      expect(mockLineItemRepo.create).toHaveBeenCalledWith({
        productId: 10,
        articleNumber: 'ART-10',
        description: 'Test Product',
        quantity: 5,
        unitPrice: '10.00',
        lineTotal: 50,
      });
      expect(mockPoRepo.save).toHaveBeenCalledWith(mockCreatedPo);
      expect(result).toEqual(mockCreatedPo);
    });

    it('should throw BadRequestException if product supplier does not match PO supplier', async () => {
      const dto = {
        supplierId: 1,
        orderDate: '2026-06-23',
        lineItems: [{ productId: 10, quantity: 5 }],
      };

      const mockSupplier = {
        id: 1,
        name: 'Test Supplier',
      };

      const mockProduct = {
        id: 10,
        name: 'Test Product',
        supplierId: 2,
      };

      mockSuppliersService.findOne.mockResolvedValue(mockSupplier);
      mockProductsService.findOne.mockResolvedValue(mockProduct);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update basic properties successfully', async () => {
      const mockPo = {
        id: 1,
        supplierId: 1,
        status: POStatus.DRAFT,
        notes: 'Old Notes',
      } as PurchaseOrder;

      mockPoRepo.findOne.mockResolvedValue(mockPo);
      mockPoRepo.save.mockImplementation((po) => Promise.resolve(po));

      const result = await service.update(1, {
        status: POStatus.SENT,
        notes: 'New Notes',
      });

      expect(result.status).toBe(POStatus.SENT);
      expect(result.notes).toBe('New Notes');
      expect(mockPoRepo.save).toHaveBeenCalledWith(mockPo);
    });

    it('should throw BadRequestException if supplierId is changed', async () => {
      const mockPo = {
        id: 1,
        supplierId: 1,
      } as PurchaseOrder;

      mockPoRepo.findOne.mockResolvedValue(mockPo);

      await expect(service.update(1, { supplierId: 2 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if line items are updated', async () => {
      const mockPo = {
        id: 1,
        supplierId: 1,
      } as PurchaseOrder;

      mockPoRepo.findOne.mockResolvedValue(mockPo);

      await expect(service.update(1, { lineItems: [] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should successfully remove a purchase order', async () => {
      const mockPo = { id: 1 } as PurchaseOrder;
      mockPoRepo.findOne.mockResolvedValue(mockPo);
      mockPoRepo.remove.mockResolvedValue(mockPo);

      await service.remove(1);

      expect(mockPoRepo.remove).toHaveBeenCalledWith(mockPo);
    });
  });
});
