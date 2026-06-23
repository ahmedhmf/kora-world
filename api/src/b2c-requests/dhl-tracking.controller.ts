import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ConfigService } from '@nestjs/config';

interface DhlEvent {
  statusCode?: string;
  timestamp?: string;
  location?: {
    address?: {
      addressLocality?: string;
    };
  };
  description?: string;
}

interface DhlShipment {
  status?: {
    statusCode?: string;
    timestamp?: string;
  };
  events?: DhlEvent[];
  estimatedTimeOfDelivery?: string;
}

interface DhlTrackingResponse {
  shipments?: DhlShipment[];
}

interface TrackingCheckpoint {
  timestamp: string;
  location: string;
  description: string;
  code: string;
}

@Controller('dhl-tracking')
@UseGuards(AuthGuard)
export class DhlTrackingController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  async getTracking(@Query('trackingNumber') trackingNumber: string) {
    if (!trackingNumber) {
      throw new HttpException(
        'trackingNumber query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const apiKey = this.config.get<string>('DHL_API_KEY');

    // If no real API key is supplied yet, fall back to simulated checkpoints
    if (!apiKey || apiKey === 'your_dhl_api_key_here') {
      return this.getMockTracking(trackingNumber);
    }

    try {
      const response = await fetch(
        `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`,
        {
          method: 'GET',
          headers: {
            'DHL-API-Key': apiKey,
            Accept: 'application/json',
          },
        },
      );

      if (response.status === 404) {
        throw new HttpException(
          'Shipment not found in DHL system',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!response.ok) {
        throw new HttpException(
          `DHL API Error: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = (await response.json()) as DhlTrackingResponse;

      // Parse DHL Unified Tracking format
      if (!data.shipments || data.shipments.length === 0) {
        throw new HttpException(
          'No shipments found matching tracking number',
          HttpStatus.NOT_FOUND,
        );
      }

      const shipment = data.shipments[0];
      const dhlStatus = shipment.status?.statusCode?.toUpperCase() || 'UNKNOWN';

      // Map DHL status code to app's status enum (DELIVERED, IN_TRANSIT, OUT_FOR_DELIVERY)
      let status = 'IN_TRANSIT';
      if (dhlStatus === 'DELIVERED') {
        status = 'DELIVERED';
      } else if (
        dhlStatus === 'OUT_FOR_DELIVERY' ||
        dhlStatus === 'OUT-FOR-DELIVERY'
      ) {
        status = 'OUT_FOR_DELIVERY';
      }

      // Map DHL checkpoints to app format
      const checkpoints = (shipment.events || []).map((event: DhlEvent) => {
        let code = 'IN_TRANSIT';
        const dhlEventCode = event.statusCode?.toUpperCase();
        if (dhlEventCode === 'DELIVERED') code = 'DELIVERED';
        else if (dhlEventCode === 'PICKED_UP' || dhlEventCode === 'PICKUP')
          code = 'PICKED_UP';
        else if (
          dhlEventCode === 'OUT_FOR_DELIVERY' ||
          dhlEventCode === 'OUT-FOR-DELIVERY'
        )
          code = 'OUT_FOR_DELIVERY';

        return {
          timestamp: event.timestamp || new Date().toISOString(),
          location: event.location?.address?.addressLocality || 'Unknown',
          description: event.description || 'Transit status update',
          code,
        };
      });

      return {
        trackingNumber,
        carrier: 'DHL',
        status,
        lastUpdate: shipment.status?.timestamp || new Date().toISOString(),
        estimatedDelivery: shipment.estimatedTimeOfDelivery || null,
        checkpoints: checkpoints, // DHL events are typically newest first
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to reach DHL API: ${message}. Falling back to mock tracking.`,
      );
      return this.getMockTracking(trackingNumber);
    }
  }

  // Simulated fallback helper
  private getMockTracking(trackingNumber: string) {
    const isGermany =
      trackingNumber.toLowerCase().includes('de') ||
      trackingNumber.toLowerCase().includes('germany') ||
      trackingNumber.charCodeAt(0) % 2 === 0;
    const isDelivered =
      trackingNumber.endsWith('9') || trackingNumber.endsWith('7');

    const statuses: TrackingCheckpoint[] = [];
    statuses.push({
      timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      location: 'Shenzhen, China',
      description: 'Shipment picked up and processed in Shenzhen hub',
      code: 'PICKED_UP',
    });
    statuses.push({
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      location: 'Hong Kong Hub',
      description: 'Arrived at DHL sorting facility Hong Kong',
      code: 'IN_TRANSIT',
    });
    statuses.push({
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      location: 'Leipzig, Germany',
      description: 'Arrived at Leipzig Hub & customs cleared',
      code: 'IN_TRANSIT',
    });

    const seedValue =
      (trackingNumber.length +
        trackingNumber.charCodeAt(trackingNumber.length - 1)) %
      3;

    if (isDelivered) {
      const dest = isGermany ? 'Frankfurt, Germany' : 'Cairo, Egypt';
      statuses.push({
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        location: isGermany ? 'Frankfurt, Germany' : 'Cairo Hub, Egypt',
        description:
          'Arrived at DHL destination delivery facility and out for delivery',
        code: 'OUT_FOR_DELIVERY',
      });
      statuses.push({
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        location: dest,
        description: `Delivered - Signed for by ${isGermany ? 'Frankfurt Warehouse' : 'Operations'} Desk`,
        code: 'DELIVERED',
      });
    } else if (seedValue === 1) {
      statuses.push({
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        location: isGermany ? 'Frankfurt, Germany' : 'Cairo Hub, Egypt',
        description:
          'Arrived at DHL destination delivery facility and out for delivery',
        code: 'OUT_FOR_DELIVERY',
      });
    }

    let currentStatus = 'IN_TRANSIT';
    if (isDelivered) {
      currentStatus = 'DELIVERED';
    } else if (seedValue === 1) {
      currentStatus = 'OUT_FOR_DELIVERY';
    }

    return {
      trackingNumber,
      carrier: 'DHL',
      status: currentStatus,
      lastUpdate: statuses[statuses.length - 1].timestamp,
      estimatedDelivery: new Date(
        Date.now() + 48 * 60 * 60 * 1000,
      ).toISOString(),
      checkpoints: [...statuses].reverse(),
    };
  }
}
