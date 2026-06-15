export type EventCategory = 'football' | 'handball' | 'cultural' | 'trade_show' | 'other';

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  category: EventCategory;
  startDate: string;
  endDate?: string;
  location?: string;
  createdById?: number;
  createdAt?: string;
}

export interface CreateEventDto {
  title: string;
  description?: string;
  category: EventCategory;
  startDate: string;
  endDate?: string;
  location?: string;
}
