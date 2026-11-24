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
}
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
