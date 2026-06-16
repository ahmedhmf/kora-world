export type B2cChannelType = 'instagram' | 'facebook' | 'whatsapp' | 'other';
export type B2cStatusType = 'pending' | 'notified' | 'fulfilled' | 'cancelled';

export interface B2cRequest {
  id: number;
  customerName: string;
  channel: B2cChannelType;
  channelUsername?: string;
  phone?: string;
  email?: string;
  productId?: number;
  product?: { id: number; name: string; articleNumber: string };
  requestedSize?: string;
  requestedColor?: string;
  quantity: number;
  status: B2cStatusType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateB2cRequestDto {
  customerName: string;
  channel: B2cChannelType;
  channelUsername?: string;
  phone?: string;
  email?: string;
  productId?: number;
  requestedSize?: string;
  requestedColor?: string;
  quantity?: number;
  status?: B2cStatusType;
  notes?: string;
}

export interface UpdateB2cRequestDto extends Partial<CreateB2cRequestDto> {}
