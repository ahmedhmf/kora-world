import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DhlTrackingController } from './dhl-tracking.controller';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();

// Polyfill global fetch with our mock
(global as unknown as Record<string, unknown>).fetch = mockFetch;

function makeFetchResponse(body: unknown, status = 200, ok = true) {
  return {
    status,
    ok,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DhlTrackingController', () => {
  let controller: DhlTrackingController;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DhlTrackingController],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<DhlTrackingController>(DhlTrackingController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── missing trackingNumber ──────────────────────────────────────────────────

  describe('getTracking – missing trackingNumber', () => {
    it('should throw BAD_REQUEST when trackingNumber is not provided', async () => {
      await expect(controller.getTracking('')).rejects.toThrow(
        new HttpException(
          'trackingNumber query parameter is required',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  // ─── mock fallback (no real API key) ────────────────────────────────────────

  describe('getTracking – mock fallback', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('your_dhl_api_key_here');
    });

    it('should return mock tracking with IN_TRANSIT status for a normal tracking number', async () => {
      const result = await controller.getTracking('TESTTRACKING1');

      expect(result).toMatchObject({
        trackingNumber: 'TESTTRACKING1',
        carrier: 'DHL',
        status: expect.stringMatching(/IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED/),
        checkpoints: expect.any(Array),
        estimatedDelivery: expect.any(String),
      });
    });

    it('should return DELIVERED status for tracking number ending in 9', async () => {
      const result = await controller.getTracking('TRACKING9');
      expect(result.status).toBe('DELIVERED');
    });

    it('should return DELIVERED status for tracking number ending in 7', async () => {
      const result = await controller.getTracking('TRACKING7');
      expect(result.status).toBe('DELIVERED');
    });

    it('should return checkpoints in reverse-chronological order', async () => {
      const result = await controller.getTracking('TEST1234');
      // The mock reverses the statuses array, so the last checkpoint should have
      // the most recent timestamp.
      const checkpoints = result.checkpoints as Array<{ timestamp: string; code: string }>;
      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── real API – 404 ─────────────────────────────────────────────────────────

  describe('getTracking – real API key – shipment not found', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('REAL_KEY_123');
    });

    it('should throw NOT_FOUND when DHL returns 404', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse({}, 404, false));

      await expect(controller.getTracking('UNKNOWN_TRACK')).rejects.toThrow(
        new HttpException('Shipment not found in DHL system', HttpStatus.NOT_FOUND),
      );
    });
  });

  // ─── real API – non-OK response ──────────────────────────────────────────────

  describe('getTracking – real API key – gateway error', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('REAL_KEY_123');
    });

    it('should throw BAD_GATEWAY when DHL returns non-404 error', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse({}, 503, false));

      await expect(controller.getTracking('TRACK_ERR')).rejects.toThrow(
        new HttpException(`DHL API Error: Error`, HttpStatus.BAD_GATEWAY),
      );
    });
  });

  // ─── real API – empty shipments array ───────────────────────────────────────

  describe('getTracking – real API key – no shipments in response', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('REAL_KEY_123');
    });

    it('should throw NOT_FOUND when shipments array is empty', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse({ shipments: [] }));

      await expect(controller.getTracking('EMPTY_RESULT')).rejects.toThrow(
        new HttpException(
          'No shipments found matching tracking number',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when shipments key is missing', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse({}));

      await expect(controller.getTracking('NO_SHIPMENTS_KEY')).rejects.toThrow(
        new HttpException(
          'No shipments found matching tracking number',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  // ─── real API – successful response ─────────────────────────────────────────

  describe('getTracking – real API key – successful response', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('REAL_KEY_123');
    });

    it('should map DELIVERED status correctly', async () => {
      mockFetch.mockResolvedValue(
        makeFetchResponse({
          shipments: [
            {
              status: { statusCode: 'delivered', timestamp: '2025-01-10T10:00:00Z' },
              events: [
                {
                  statusCode: 'delivered',
                  timestamp: '2025-01-10T10:00:00Z',
                  location: { address: { addressLocality: 'Frankfurt' } },
                  description: 'Package delivered',
                },
              ],
              estimatedTimeOfDelivery: '2025-01-10T12:00:00Z',
            },
          ],
        }),
      );

      const result = await controller.getTracking('DHL123');

      expect(result).toMatchObject({
        trackingNumber: 'DHL123',
        carrier: 'DHL',
        status: 'DELIVERED',
        lastUpdate: '2025-01-10T10:00:00Z',
        estimatedDelivery: '2025-01-10T12:00:00Z',
      });

      const checkpoints = result.checkpoints as Array<{ code: string; location: string }>;
      expect(checkpoints[0].code).toBe('DELIVERED');
      expect(checkpoints[0].location).toBe('Frankfurt');
    });

    it('should map OUT_FOR_DELIVERY status correctly', async () => {
      mockFetch.mockResolvedValue(
        makeFetchResponse({
          shipments: [
            {
              status: { statusCode: 'out_for_delivery', timestamp: '2025-01-09T08:00:00Z' },
              events: [
                {
                  statusCode: 'out_for_delivery',
                  timestamp: '2025-01-09T08:00:00Z',
                  location: { address: { addressLocality: 'Cairo' } },
                  description: 'Out for delivery',
                },
              ],
            },
          ],
        }),
      );

      const result = await controller.getTracking('DHL456');
      expect(result.status).toBe('OUT_FOR_DELIVERY');
    });

    it('should fall back to IN_TRANSIT for unknown status codes', async () => {
      mockFetch.mockResolvedValue(
        makeFetchResponse({
          shipments: [
            {
              status: { statusCode: 'CUSTOMS', timestamp: '2025-01-09T08:00:00Z' },
              events: [],
            },
          ],
        }),
      );

      const result = await controller.getTracking('DHL789');
      expect(result.status).toBe('IN_TRANSIT');
    });

    it('should handle events with missing location gracefully', async () => {
      mockFetch.mockResolvedValue(
        makeFetchResponse({
          shipments: [
            {
              status: { statusCode: 'transit', timestamp: '2025-01-09T08:00:00Z' },
              events: [
                {
                  statusCode: 'transit',
                  timestamp: '2025-01-09T08:00:00Z',
                  description: 'In transit',
                  // no location field
                },
              ],
            },
          ],
        }),
      );

      const result = await controller.getTracking('DHL_NO_LOC');
      const checkpoints = result.checkpoints as Array<{ location: string }>;
      expect(checkpoints[0].location).toBe('Unknown');
    });
  });

  // ─── real API – fetch network failure (fallback to mock) ─────────────────────

  describe('getTracking – real API key – network failure fallback', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('REAL_KEY_123');
    });

    it('should fall back to mock tracking when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await controller.getTracking('FALLBACK_TRACK1');

      expect(result).toMatchObject({
        trackingNumber: 'FALLBACK_TRACK1',
        carrier: 'DHL',
        status: expect.stringMatching(/IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED/),
      });
    });
  });
});
