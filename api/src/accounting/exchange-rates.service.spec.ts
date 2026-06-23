import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { BadRequestException } from '@nestjs/common';

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;
  let rateRepo: jest.Mocked<Repository<ExchangeRate>>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        {
          provide: getRepositoryToken(ExchangeRate),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<ExchangeRatesService>(ExchangeRatesService);
    rateRepo = module.get(getRepositoryToken(ExchangeRate));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRate', () => {
    it('should return 1.0 when fromCurrency is EGP', async () => {
      const rate = await service.getRate('EGP', '2026-06-23');
      expect(rate).toBe(1.0);
      expect(rateRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should return the rate if found directly', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce({
        id: 1,
        fromCurrency: 'USD',
        toCurrency: 'EGP',
        rate: 50.5,
        date: '2026-06-23',
      } as ExchangeRate);

      const rate = await service.getRate('USD', '2026-06-23');
      expect(rate).toBe(50.5);
      expect(rateRepo.createQueryBuilder).toHaveBeenCalledWith('rate');
    });

    it('should return 1 / inverse rate if inverse rate is found', async () => {
      // First call (direct rate query) returns null
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);
      // Second call (inverse rate query) returns rate record
      mockQueryBuilder.getOne.mockResolvedValueOnce({
        id: 2,
        fromCurrency: 'EGP',
        toCurrency: 'USD',
        rate: 0.02, // 1 / 50
        date: '2026-06-23',
      } as ExchangeRate);

      const rate = await service.getRate('USD', '2026-06-23');
      expect(rate).toBe(50);
    });

    it('should throw BadRequestException if direct and inverse rates are not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);

      await expect(service.getRate('USD', '2026-06-23')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('convertToEGP', () => {
    it('should convert amount to EGP using getRate', async () => {
      jest.spyOn(service, 'getRate').mockResolvedValue(50.5);
      const result = await service.convertToEGP(100, 'USD', '2026-06-23');
      expect(result).toBe(5050);
      expect(service.getRate).toHaveBeenCalledWith('USD', '2026-06-23');
    });
  });

  describe('findAll', () => {
    it('should return all exchange rates ordered by date DESC', async () => {
      const mockRates = [
        { id: 1, fromCurrency: 'USD', toCurrency: 'EGP', rate: 50.5, date: '2026-06-23' },
      ] as ExchangeRate[];
      rateRepo.find.mockResolvedValueOnce(mockRates);

      const result = await service.findAll();
      expect(result).toEqual(mockRates);
      expect(rateRepo.find).toHaveBeenCalledWith({ order: { date: 'DESC' } });
    });
  });

  describe('create', () => {
    it('should create and save a new exchange rate in uppercase', async () => {
      const dto = {
        fromCurrency: 'usd',
        rate: 50.5,
        date: '2026-06-23',
        notes: 'Test note',
      };
      const createdRate = { ...dto, fromCurrency: 'USD', toCurrency: 'EGP', date: new Date(dto.date) };
      rateRepo.create.mockReturnValueOnce(createdRate as any);
      rateRepo.save.mockResolvedValueOnce(createdRate as any);

      const result = await service.create(dto);
      expect(rateRepo.create).toHaveBeenCalledWith({
        fromCurrency: 'USD',
        toCurrency: 'EGP',
        rate: dto.rate,
        date: new Date(dto.date),
        notes: dto.notes,
      });
      expect(rateRepo.save).toHaveBeenCalledWith(createdRate);
      expect(result).toEqual(createdRate);
    });
  });

  describe('remove', () => {
    it('should delete the exchange rate by ID', async () => {
      rateRepo.delete.mockResolvedValueOnce({ raw: [], affected: 1 });
      await service.remove(1);
      expect(rateRepo.delete).toHaveBeenCalledWith(1);
    });
  });
});
