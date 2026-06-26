import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SourcingService } from './sourcing.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SourcingQueryDto } from './dto/sourcing.dto';

describe('SourcingService', () => {
  let service: SourcingService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ANTHROPIC_API_KEY') {
                return 'mock-api-key';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SourcingService>(SourcingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('researchSuppliers', () => {
    it('should throw HttpException if API key is missing', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);
      const query: SourcingQueryDto = { sport: 'football', tier: 'match_pro' };

      await expect(service.researchSuppliers(query)).rejects.toThrow(
        HttpException,
      );
    });

    it('should call fetch and parse the JSON response', async () => {
      const mockResult = {
        suppliers: [
          {
            name: 'Test Supplier',
            country: 'Pakistan',
            tierFit: 'match_pro',
            coverMaterial: 'PU',
            bladder: 'Latex',
            stitching: 'Hand-stitched',
            certifications: ['FIFA Quality Pro'],
            estimatedMoq: '500',
            estimatedFobPrice: '$10',
            paymentMethods: ['T/T'],
            contactInfo: 'test@example.com',
            notes: 'Good score',
            score: 9,
          },
        ],
        recommended: 'Test Supplier',
        reasoning: 'Best fit',
        contactEmailDraft: 'Dear Test Supplier...',
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify(mockResult),
            },
          ],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const query: SourcingQueryDto = {
        sport: 'football',
        tier: 'match_pro',
        certifications: ['FIFA Quality'],
        targetMarket: 'Egypt',
        budgetPerUnit: '$10',
        moqMax: 500,
        notes: 'Urgent request',
      };

      const result = await service.researchSuppliers(query);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'mock-api-key',
          }),
        }),
      );
      expect(result).toEqual(mockResult);
    });
  });
});
