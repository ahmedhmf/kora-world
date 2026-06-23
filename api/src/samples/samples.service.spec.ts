import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SamplesService } from './samples.service';
import { Sample, SampleStatus } from './entities/sample.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { NotFoundException } from '@nestjs/common';
import { CreateSampleDto } from './dto/create-sample.dto';
import { UpdateSampleDto } from './dto/update-sample.dto';
import { ProductCategory } from '../products/entities/product.entity';

describe('SamplesService', () => {
  let service: SamplesService;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockSampleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockSuppliersService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamplesService,
        {
          provide: getRepositoryToken(Sample),
          useValue: mockSampleRepo,
        },
        {
          provide: SuppliersService,
          useValue: mockSuppliersService,
        },
      ],
    }).compile();

    service = module.get<SamplesService>(SamplesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should find all samples and filter by supplierId if provided', async () => {
      const mockSamples = [{ id: 1, name: 'Sample A' }] as unknown as Sample[];
      mockSampleRepo.find.mockResolvedValue(mockSamples);

      const result = await service.findAll(3);

      expect(result).toEqual(mockSamples);
      expect(mockSampleRepo.find).toHaveBeenCalledWith({
        where: { supplierId: 3 },
        relations: { supplier: true, parentSample: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('should find all samples without supplierId filter', async () => {
      const mockSamples = [{ id: 1, name: 'Sample A' }] as unknown as Sample[];
      mockSampleRepo.find.mockResolvedValue(mockSamples);

      const result = await service.findAll();

      expect(result).toEqual(mockSamples);
      expect(mockSampleRepo.find).toHaveBeenCalledWith({
        where: {},
        relations: { supplier: true, parentSample: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a sample if found', async () => {
      const mockSample = { id: 1, name: 'Sample A' } as unknown as Sample;
      mockSampleRepo.findOne.mockResolvedValue(mockSample);

      const result = await service.findOne(1);

      expect(result).toEqual(mockSample);
      expect(mockSampleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { supplier: { contacts: true }, parentSample: true },
      });
    });

    it('should throw NotFoundException if sample is not found', async () => {
      mockSampleRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRoundsChain', () => {
    it('should walk up to find all ancestors and walk down to find all descendants, returning sorted list', async () => {
      // Ancestor chain: 3 -> 2 -> 1
      mockSampleRepo.findOne.mockImplementation(async (options: any) => {
        const id = options.where.id;
        if (id === 3) return { id: 3, parentSampleId: 2, roundNumber: 3 } as unknown as Sample;
        if (id === 2) return { id: 2, parentSampleId: 1, roundNumber: 2 } as unknown as Sample;
        if (id === 1) return { id: 1, parentSampleId: null, roundNumber: 1 } as unknown as Sample;
        return null;
      });

      mockSampleRepo.find.mockImplementation(async (options: any) => {
        const parentId = options.where.parentSampleId;
        if (parentId === 1) return [{ id: 2, parentSampleId: 1, roundNumber: 2 }] as unknown as Sample[];
        if (parentId === 2) return [{ id: 3, parentSampleId: 2, roundNumber: 3 }] as unknown as Sample[];
        return [] as Sample[];
      });

      const result = await service.findRoundsChain(3);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it('should throw NotFoundException if root ancestor is not found', async () => {
      mockSampleRepo.findOne.mockResolvedValue(null);

      await expect(service.findRoundsChain(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getNextCounter', () => {
    it('should return 1 if no sample with same collection, year, category exists', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.getNextCounter('col', 2026, 'football');

      expect(result).toBe(1);
      expect(mockSampleRepo.createQueryBuilder).toHaveBeenCalledWith('sample');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('sample.collection = :collection', { collection: 'col' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('sample.year = :year', { year: 2026 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('sample.category = :category', { category: 'football' });
    });

    it('should return maxSample.articleCounter + 1 if samples exist', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ articleCounter: 8 });

      const result = await service.getNextCounter('col', 2026, 'football');

      expect(result).toBe(9);
    });
  });

  describe('create', () => {
    it('should validate supplier exists, auto-generate attributes and save sample', async () => {
      const dto: CreateSampleDto = {
        name: 'New Sample',
        supplierId: 2,
        collection: 'SS',
        year: 2026,
        category: ProductCategory.FOOTBALL,
        status: SampleStatus.REQUESTED,
        roundNumber: 1,
      };

      mockSuppliersService.findOne.mockResolvedValue({ id: 2, name: 'Supplier' });
      mockQueryBuilder.getOne.mockResolvedValue({ articleCounter: 4 });

      const expectedSample = {
        ...dto,
        articleCounter: 5,
        articleNumber: 'SPSS260005FB',
      } as unknown as Sample;

      mockSampleRepo.create.mockReturnValue(expectedSample);
      mockSampleRepo.save.mockResolvedValue(expectedSample);

      const result = await service.create(dto);

      expect(result).toEqual(expectedSample);
      expect(mockSuppliersService.findOne).toHaveBeenCalledWith(2);
      expect(mockSampleRepo.create).toHaveBeenCalledWith(dto);
      expect(mockSampleRepo.save).toHaveBeenCalledWith(expectedSample);
    });

    it('should fall back to default collection, year, and category if omitted in DTO', async () => {
      const dto: CreateSampleDto = {
        name: 'Default Sample',
        supplierId: 2,
        status: SampleStatus.REQUESTED,
        roundNumber: 1,
      };

      mockSuppliersService.findOne.mockResolvedValue({ id: 2, name: 'Supplier' });
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const currentYear = new Date().getFullYear();
      const yearStr = String(currentYear).slice(-2);
      const expectedSample = {
        ...dto,
        collection: 'SS',
        year: currentYear,
        articleCounter: 1,
        articleNumber: `SPSS${yearStr}0001OTH`,
      } as unknown as Sample;

      mockSampleRepo.create.mockReturnValue(expectedSample);
      mockSampleRepo.save.mockResolvedValue(expectedSample);

      const result = await service.create(dto);

      expect(result.collection).toBe('SS');
      expect(result.year).toBe(currentYear);
      expect(result.articleNumber).toBe(`SPSS${yearStr}0001OTH`);
    });
  });

  describe('update', () => {
    it('should find, validate supplier (if in dto), update, and save sample', async () => {
      const existingSample = { id: 1, name: 'Old Name', supplierId: 2 } as unknown as Sample;
      mockSampleRepo.findOne.mockResolvedValue(existingSample);
      mockSuppliersService.findOne.mockResolvedValue({ id: 3, name: 'Supplier 3' });
      mockSampleRepo.save.mockImplementation((val) => Promise.resolve(val));

      const dto: UpdateSampleDto = { name: 'New Name', supplierId: 3 };

      const result = await service.update(1, dto);

      expect(result.name).toBe('New Name');
      expect(result.supplierId).toBe(3);
      expect(mockSuppliersService.findOne).toHaveBeenCalledWith(3);
      expect(mockSampleRepo.save).toHaveBeenCalledWith(existingSample);
    });

    it('should update sample without supplier validation if supplierId is not in dto', async () => {
      const existingSample = { id: 1, name: 'Old Name', supplierId: 2 } as unknown as Sample;
      mockSampleRepo.findOne.mockResolvedValue(existingSample);
      mockSampleRepo.save.mockImplementation((val) => Promise.resolve(val));

      const dto: UpdateSampleDto = { name: 'New Name' };

      const result = await service.update(1, dto);

      expect(result.name).toBe('New Name');
      expect(mockSuppliersService.findOne).not.toHaveBeenCalled();
      expect(mockSampleRepo.save).toHaveBeenCalledWith(existingSample);
    });
  });

  describe('remove', () => {
    it('should find and remove sample', async () => {
      const existingSample = { id: 1, name: 'Sample' } as unknown as Sample;
      mockSampleRepo.findOne.mockResolvedValue(existingSample);
      mockSampleRepo.remove.mockResolvedValue(existingSample);

      await service.remove(1);

      expect(mockSampleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { supplier: { contacts: true }, parentSample: true },
      });
      expect(mockSampleRepo.remove).toHaveBeenCalledWith(existingSample);
    });
  });
});
