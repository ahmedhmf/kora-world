import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DropdownOption, CreateDropdownOptionDto } from '../models/dropdown-option.model';

@Injectable({ providedIn: 'root' })
export class DropdownOptionsService {
  private readonly http = inject(HttpClient);

  private get base(): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '/api';
  }

  getOptions(category?: string): Observable<DropdownOption[]> {
    const url = category ? `${this.base}/dropdown-options?category=${category}` : `${this.base}/dropdown-options`;
    return this.http.get<DropdownOption[]>(url);
  }

  createOption(dto: CreateDropdownOptionDto): Observable<DropdownOption> {
    return this.http.post<DropdownOption>(`${this.base}/dropdown-options`, dto);
  }

  updateOption(id: number, dto: CreateDropdownOptionDto): Observable<DropdownOption> {
    return this.http.patch<DropdownOption>(`${this.base}/dropdown-options/${id}`, dto);
  }

  deleteOption(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/dropdown-options/${id}`);
  }
}
