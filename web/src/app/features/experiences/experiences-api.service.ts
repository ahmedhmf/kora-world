import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type CombineMode = 'sum' | 'shared';
export interface ExperienceItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  mode: CombineMode;
  notes?: string;
  inventoryKind?: 'product' | 'equipment';
  inventoryId?: number;
}
export interface ReservationInput { warehouseId:number; locationId:number; startsAt:string; endsAt:string; }
export interface AvailabilityItem { key:string; name:string; quantity:number; physical:number; reservedByOthers:number; available:number; missing:number; }
export interface ReconcileLine { reservationId:number; returned:number; damaged:number; missing:number; consumed:number; notes:string; }
export interface EventReservation { inventoryKind:'product'|'equipment'; returned:number|null; damaged:number|null; missing:number|null; consumed:number|null; reconciliationNotes:string|null; dispatchedAt:string|null; reconciledAt:string|null; id:number; status:string; name:string; quantity:number; warehouseName:string; locationCode:string; startsAt:string; endsAt:string; }
export interface KoraExperience {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  items: ExperienceItem[];
}
export interface PackingItem extends ExperienceItem {
  key: string;
  packed: boolean;
  sources: string[];
}

@Injectable({ providedIn: 'root' })
export class ExperiencesApiService {
  private readonly http = inject(HttpClient);
  private get base(): string {
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return local ? 'http://localhost:3000' : '/api';
  }

  reservations(id:number) { return this.http.get<EventReservation[]>(`${this.base}/events/${id}/stock-reservations`); }
  previewReservation(id:number,dto:ReservationInput) { return this.http.post<{items:AvailabilityItem[];manual:ExperienceItem[]}>(`${this.base}/events/${id}/stock-reservations/preview`,dto); }
  reserve(id:number,dto:ReservationInput) { return this.http.post<unknown>(`${this.base}/events/${id}/stock-reservations`,dto); }
  dispatchEvent(id:number) { return this.http.post<unknown>(`${this.base}/events/${id}/stock-reservations/dispatch`,{}); }
  reconcileEvent(id:number,lines:ReconcileLine[]) { return this.http.post<unknown>(`${this.base}/events/${id}/stock-reservations/reconcile`,{lines}); }
  cancelReservation(id:number) { return this.http.post<unknown>(`${this.base}/events/${id}/stock-reservations/cancel`,{}); }
  list() { return this.http.get<KoraExperience[]>(`${this.base}/experiences`); }
  create(data: Omit<KoraExperience, 'id'>) { return this.http.post<KoraExperience>(`${this.base}/experiences`, data); }
  update(id: number, data: Omit<KoraExperience, 'id'>) { return this.http.put<KoraExperience>(`${this.base}/experiences/${id}`, data); }
  delete(id: number) { return this.http.delete(`${this.base}/experiences/${id}`); }
  selected(eventId: number) { return this.http.get<number[]>(`${this.base}/events/${eventId}/experiences`); }
  assign(eventId: number, ids: number[]) { return this.http.put<number[]>(`${this.base}/events/${eventId}/experiences`, { experienceIds: ids }); }
  checklist(eventId: number) { return this.http.get<PackingItem[]>(`${this.base}/events/${eventId}/experience-checklist`); }
  generate(eventId: number) { return this.http.post<PackingItem[]>(`${this.base}/events/${eventId}/experience-checklist/generate`, {}); }
  setPacked(eventId: number, key: string, packed: boolean) {
    return this.http.patch<PackingItem[]>(`${this.base}/events/${eventId}/experience-checklist/${encodeURIComponent(key)}`, { packed });
  }
  addEventItem(eventId: number, data: ExperienceItem) {
    return this.http.post<PackingItem[]>(`${this.base}/events/${eventId}/experience-checklist/items`, data);
  }
}
