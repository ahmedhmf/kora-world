import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { B2cRequestsService } from './b2c-requests.service';
import { B2cRequest } from './entities/b2c-request.entity.js';
import { CreateB2cRequestDto } from './dto/create-b2c-request.dto.js';
import { UpdateB2cRequestDto } from './dto/update-b2c-request.dto.js';

describe('B2cRequestsService', () => {
  let service: B2cRequestsService;

  const mockB2cRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        B2cRequestsService,
        {
          provide: getRepositoryToken(B2cRequest),
          useValue: mockB2cRepo,
        },
      ],
    }).compile();

    service = module.get<B2cRequestsService>(B2cRequestsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all b2c requests ordered by createdAt DESC', async () => {
      const mockRequests = [{ id: 1, notes: 'req1' }] as B2cRequest[];
      mockB2cRepo.find.mockResolvedValue(mockRequests);

      const result = await service.findAll();

      expect(result).toEqual(mockRequests);
      expect(mockB2cRepo.find).toHaveBeenCalledWith({
        relations: { product: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the b2c request when found', async () => {
      const mockRequest = { id: 1, notes: 'req1' } as B2cRequest;
      mockB2cRepo.findOne.mockResolvedValue(mockRequest);

      const result = await service.findOne(1);

      expect(result).toEqual(mockRequest);
      expect(mockB2cRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { product: true },
      });
    });

    it('should throw NotFoundException when request is not found', async () => {
      mockB2cRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create, save, and re-fetch the request with relations', async () => {
      const dto: CreateB2cRequestDto = { notes: 'new request' } as CreateB2cRequestDto;
      const saved = { id: 5, notes: 'new request' } as B2cRequest;
      const withRelations = { id: 5, notes: 'new request', product: null } as B2cRequest;

      mockB2cRepo.create.mockReturnValue(saved);
      mockB2cRepo.save.mockResolvedValue(saved);
      // findOne called by create → returns with relations
      mockB2cRepo.findOne.mockResolvedValue(withRelations);

      const result = await service.create(dto);

      expect(result).toEqual(withRelations);
      expect(mockB2cRepo.create).toHaveBeenCalledWith(dto);
      expect(mockB2cRepo.save).toHaveBeenCalledWith(saved);
      expect(mockB2cRepo.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
        relations: { product: true },
      });
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update fields and return re-fetched request', async () => {
      const existing = { id: 1, notes: 'old', productId: 10 } as unknown as B2cRequest;
      const updated = { id: 1, notes: 'new', productId: 10 } as unknown as B2cRequest;

      // First findOne call (in update) then second (at end of update)
      mockB2cRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);
      mockB2cRepo.save.mockResolvedValue(existing);

      const dto: UpdateB2cRequestDto = { notes: 'new' } as UpdateB2cRequestDto;
      const result = await service.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockB2cRepo.save).toHaveBeenCalledWith(existing);
    });

    it('should clear productId and product when productId is null in dto', async () => {
      const existing = { id: 1, notes: 'req', productId: 5, product: { id: 5 } } as unknown as B2cRequest;
      const updated = { id: 1, notes: 'req', productId: undefined, product: undefined } as unknown as B2cRequest;

      mockB2cRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);
      mockB2cRepo.save.mockResolvedValue(existing);

      const dto: UpdateB2cRequestDto = { productId: null } as unknown as UpdateB2cRequestDto;
      const result = await service.update(1, dto);

      expect(existing.productId).toBeUndefined();
      expect(existing.product).toBeUndefined();
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if request does not exist', async () => {
      mockB2cRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, {} as UpdateB2cRequestDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove the request when found', async () => {
      const mockRequest = { id: 1 } as B2cRequest;
      mockB2cRepo.findOne.mockResolvedValue(mockRequest);
      mockB2cRepo.remove.mockResolvedValue(mockRequest);

      await service.remove(1);

      expect(mockB2cRepo.remove).toHaveBeenCalledWith(mockRequest);
    });

    it('should throw NotFoundException if request does not exist', async () => {
      mockB2cRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
