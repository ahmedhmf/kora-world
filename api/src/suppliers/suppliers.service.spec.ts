import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuppliersService } from './suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { NotFoundException } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

describe('SuppliersService', () => {
  let service: SuppliersService;

  const mockSupplierRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: getRepositoryToken(Supplier),
          useValue: mockSupplierRepo,
        },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of suppliers', async () => {
      const mockSuppliers = [
        { id: 1, name: 'Supplier A', contacts: [] },
      ] as unknown as Supplier[];
      mockSupplierRepo.find.mockResolvedValue(mockSuppliers);

      const result = await service.findAll();

      expect(result).toEqual(mockSuppliers);
      expect(mockSupplierRepo.find).toHaveBeenCalledWith({
        relations: { contacts: true },
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a supplier if found', async () => {
      const mockSupplier = { id: 1, name: 'Supplier A', contacts: [], products: [] } as unknown as Supplier;
      mockSupplierRepo.findOne.mockResolvedValue(mockSupplier);

      const result = await service.findOne(1);

      expect(result).toEqual(mockSupplier);
      expect(mockSupplierRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { products: true, contacts: true },
      });
    });

    it('should throw NotFoundException if supplier is not found', async () => {
      mockSupplierRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and save a new supplier', async () => {
      const dto: CreateSupplierDto = { name: 'New Supplier', country: 'Germany' };
      const createdSupplier = { id: 1, ...dto } as unknown as Supplier;

      mockSupplierRepo.create.mockReturnValue(createdSupplier);
      mockSupplierRepo.save.mockResolvedValue(createdSupplier);

      const result = await service.create(dto);

      expect(result).toEqual(createdSupplier);
      expect(mockSupplierRepo.create).toHaveBeenCalledWith(dto);
      expect(mockSupplierRepo.save).toHaveBeenCalledWith(createdSupplier);
    });
  });

  describe('update', () => {
    it('should update a supplier and save with contacts cascading', async () => {
      const existingSupplier = {
        id: 1,
        name: 'Old Name',
        contacts: [
          { id: 10, name: 'Contact A' } as SupplierContact,
        ],
      } as unknown as Supplier;

      mockSupplierRepo.findOne.mockResolvedValue(existingSupplier);
      mockSupplierRepo.save.mockImplementation((val: Supplier) => Promise.resolve(val));

      const dto: UpdateSupplierDto = {
        name: 'New Name',
        contacts: [
          { id: 10, name: 'Contact A Updated' },
          { name: 'Contact B' },
        ],
      };

      const result = await service.update(1, dto);

      expect(result.name).toBe('New Name');
      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0].name).toBe('Contact A Updated');
      expect(result.contacts[1].name).toBe('Contact B');
      expect(result.contacts[1]).toBeInstanceOf(SupplierContact);
      expect(mockSupplierRepo.save).toHaveBeenCalledWith(existingSupplier);
    });

    it('should update supplier fields without contacts if contacts is not provided', async () => {
      const existingSupplier = {
        id: 1,
        name: 'Old Name',
        contacts: [],
      } as unknown as Supplier;

      mockSupplierRepo.findOne.mockResolvedValue(existingSupplier);
      mockSupplierRepo.save.mockImplementation((val: Supplier) => Promise.resolve(val));

      const dto: UpdateSupplierDto = { name: 'New Name' };

      const result = await service.update(1, dto);

      expect(result.name).toBe('New Name');
      expect(result.contacts).toEqual([]);
      expect(mockSupplierRepo.save).toHaveBeenCalledWith(existingSupplier);
    });
  });

  describe('remove', () => {
    it('should remove the supplier if found', async () => {
      const mockSupplier = { id: 1, name: 'Supplier' } as unknown as Supplier;
      mockSupplierRepo.findOne.mockResolvedValue(mockSupplier);
      mockSupplierRepo.remove.mockResolvedValue(mockSupplier);

      await service.remove(1);

      expect(mockSupplierRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { products: true, contacts: true },
      });
      expect(mockSupplierRepo.remove).toHaveBeenCalledWith(mockSupplier);
    });
  });
});
