import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product, ProductCategory } from './entities/product.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockProductRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockSuppliersService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepo,
        },
        {
          provide: SuppliersService,
          useValue: mockSuppliersService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should find all active products and filter by supplierId and category if provided', async () => {
      const mockProducts = [{ id: 1, name: 'Product A', isActive: true }] as unknown as Product[];
      mockProductRepo.find.mockResolvedValue(mockProducts);

      const result = await service.findAll(2, 'football');

      expect(result).toEqual(mockProducts);
      expect(mockProductRepo.find).toHaveBeenCalledWith({
        where: {
          isActive: true,
          supplierId: 2,
          category: ProductCategory.FOOTBALL,
        },
        relations: { supplier: true },
        order: { name: 'ASC' },
      });
    });

    it('should find all active products with default where clause', async () => {
      const mockProducts = [{ id: 1, name: 'Product A', isActive: true }] as unknown as Product[];
      mockProductRepo.find.mockResolvedValue(mockProducts);

      const result = await service.findAll();

      expect(result).toEqual(mockProducts);
      expect(mockProductRepo.find).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        relations: { supplier: true },
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a product if found', async () => {
      const mockProduct = { id: 1, name: 'Product A' } as unknown as Product;
      mockProductRepo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findOne(1);

      expect(result).toEqual(mockProduct);
      expect(mockProductRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { supplier: true },
      });
    });

    it('should throw NotFoundException if product is not found', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySupplier', () => {
    it('should return active products for a supplier', async () => {
      const mockProducts = [{ id: 1, name: 'Product A', supplierId: 5 }] as unknown as Product[];
      mockProductRepo.find.mockResolvedValue(mockProducts);

      const result = await service.findBySupplier(5);

      expect(result).toEqual(mockProducts);
      expect(mockProductRepo.find).toHaveBeenCalledWith({
        where: { supplierId: 5, isActive: true },
        order: { articleNumber: 'ASC' },
      });
    });
  });

  describe('getNextCounter', () => {
    it('should return 1 if no product with same collection, year, category exists', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.getNextCounter('col', 2026, 'football');

      expect(result).toBe(1);
      expect(mockProductRepo.createQueryBuilder).toHaveBeenCalledWith('product');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('product.collection = :collection', { collection: 'col' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('product.year = :year', { year: 2026 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('product.category = :category', { category: 'football' });
    });

    it('should return maxProduct.articleCounter + 1 if products exist', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ articleCounter: 5 });

      const result = await service.getNextCounter('col', 2026, 'football');

      expect(result).toBe(6);
    });
  });

  describe('create', () => {
    it('should validate supplier exists, generate article number, and save product', async () => {
      const dto: CreateProductDto = {
        name: 'New Product',
        supplierId: 2,
        collection: 'col',
        year: 2026,
        category: ProductCategory.FOOTBALL,
        unitPrice: 10,
        currency: 'USD',
        moq: 100,
        weightKg: 0.5,
      };

      mockSuppliersService.findOne.mockResolvedValue({ id: 2, name: 'Supplier' });
      
      const expectedProduct = {
        ...dto,
        articleCounter: 6,
        articleNumber: 'col260006FB',
      } as unknown as Product;

      mockProductRepo.create.mockReturnValue(expectedProduct);
      mockQueryBuilder.getOne.mockResolvedValue({ articleCounter: 5 });
      mockProductRepo.save.mockResolvedValue(expectedProduct);

      const result = await service.create(dto);

      expect(result).toEqual(expectedProduct);
      expect(mockSuppliersService.findOne).toHaveBeenCalledWith(2);
      expect(mockProductRepo.create).toHaveBeenCalledWith(dto);
      expect(mockProductRepo.save).toHaveBeenCalledWith(expectedProduct);
    });

    it('should work with different categories and default to OTH', async () => {
      const dto: CreateProductDto = {
        name: 'Other Product',
        supplierId: 2,
        collection: 'col',
        year: 2026,
        category: 'other' as ProductCategory,
        unitPrice: 10,
        currency: 'USD',
        moq: 100,
        weightKg: 0.5,
      };

      mockSuppliersService.findOne.mockResolvedValue({ id: 2, name: 'Supplier' });
      
      const expectedProduct = {
        ...dto,
        articleCounter: 1,
        articleNumber: 'col260001OTH',
      } as unknown as Product;

      mockProductRepo.create.mockReturnValue(expectedProduct);
      mockQueryBuilder.getOne.mockResolvedValue(null); // Return null, so counter is 1
      mockProductRepo.save.mockResolvedValue(expectedProduct);

      const result = await service.create(dto);

      expect(result.articleNumber).toBe('col260001OTH');
    });

    it('should not generate article number if collection, year, or category is missing', async () => {
      const dto: CreateProductDto = {
        name: 'New Product',
        supplierId: 2,
        unitPrice: 10,
        currency: 'USD',
        moq: 100,
        weightKg: 0.5,
      };

      mockSuppliersService.findOne.mockResolvedValue({ id: 2, name: 'Supplier' });
      
      const expectedProduct = {
        ...dto,
      } as unknown as Product;

      mockProductRepo.create.mockReturnValue(expectedProduct);
      mockProductRepo.save.mockResolvedValue(expectedProduct);

      const result = await service.create(dto);

      expect(result.articleNumber).toBeUndefined();
      expect(mockProductRepo.save).toHaveBeenCalledWith(expectedProduct);
    });
  });

  describe('update', () => {
    it('should find, validate supplier (if in dto), update, and save product', async () => {
      const existingProduct = { id: 1, name: 'Old Name', supplierId: 2 } as unknown as Product;
      mockProductRepo.findOne.mockResolvedValue(existingProduct);
      mockSuppliersService.findOne.mockResolvedValue({ id: 3, name: 'New Supplier' });
      mockProductRepo.save.mockImplementation((val) => Promise.resolve(val));

      const dto: UpdateProductDto = { name: 'New Name', supplierId: 3 };

      const result = await service.update(1, dto);

      expect(result.name).toBe('New Name');
      expect(result.supplierId).toBe(3);
      expect(mockSuppliersService.findOne).toHaveBeenCalledWith(3);
      expect(mockProductRepo.save).toHaveBeenCalledWith(existingProduct);
    });

    it('should update product without validation if supplierId is not provided', async () => {
      const existingProduct = { id: 1, name: 'Old Name', supplierId: 2 } as unknown as Product;
      mockProductRepo.findOne.mockResolvedValue(existingProduct);
      mockProductRepo.save.mockImplementation((val) => Promise.resolve(val));

      const dto: UpdateProductDto = { name: 'New Name' };

      const result = await service.update(1, dto);

      expect(result.name).toBe('New Name');
      expect(mockSuppliersService.findOne).not.toHaveBeenCalled();
      expect(mockProductRepo.save).toHaveBeenCalledWith(existingProduct);
    });
  });

  describe('remove', () => {
    it('should soft delete by setting isActive to false', async () => {
      const existingProduct = { id: 1, name: 'Product A', isActive: true } as unknown as Product;
      mockProductRepo.findOne.mockResolvedValue(existingProduct);
      mockProductRepo.save.mockImplementation((val) => Promise.resolve(val));

      await service.remove(1);

      expect(existingProduct.isActive).toBe(false);
      expect(mockProductRepo.save).toHaveBeenCalledWith(existingProduct);
    });
  });
});
