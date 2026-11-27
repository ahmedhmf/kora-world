import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CalendarEvent } from '../../core/models/event.model';

interface EventDocument {
  id: number;
  originalName: string;
  category: string;
  sizeBytes: number;
  createdAt: string;
}
interface PostEventReport {
  attendance: number | null;
  summary: string;
  successes: string;
  problems: string;
  missingEquipment: string;
  lessonsLearned: string;
  nextActions: string;
}
@Component({
  selector: 'app-event-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './event-operations.component.html',
  styles: [`
    @media print {
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      .report-print { background: white !important; color: black !important; padding: 0 !important; border: 0 !important; }
      .report-print * { color: black !important; }
      .report-print section { break-inside: avoid; }
      @page { size: A4 portrait; margin: 18mm; }
    }
  `],
})
export class EventOperationsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private get base() {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3000' : '/api';
  }
  readonly eventId = Number(this.route.snapshot.paramMap.get('id'));
  readonly event = signal<CalendarEvent | null>(null);
  readonly documents = signal<EventDocument[]>([]);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly busy = signal(false);
  readonly tab = signal<'documents' | 'report'>('documents');
  readonly reportReady = signal(false);
  readonly reportSaved = signal(false);
  documentCategory = 'contract';
  report: PostEventReport = this.emptyReport();
  readonly categories = [
    { value: 'contract', name: 'Contract' },
    { value: 'venue-plan', name: 'Venue Plan' },
    { value: 'permit', name: 'Permit' },
    { value: 'invoice', name: 'Invoice' },
    { value: 'photo', name: 'Photo' },
    { value: 'other', name: 'Other' },
  ];

  private emptyReport(): PostEventReport {
    return { attendance: null, summary: '', successes: '', problems: '',
      missingEquipment: '', lessonsLearned: '', nextActions: '' };
  }

  ngOnInit() {
    if (!Number.isSafeInteger(this.eventId) || this.eventId < 1) { this.error.set('Invalid event ID'); return; }
    this.api.getEvent(this.eventId).subscribe({
      next: e => this.event.set(e), error: () => this.error.set('Event not found'),
    });
    this.loadDocuments();
    this.loadReport();
  }

  loadDocuments() {
    this.http.get<EventDocument[]>(`${this.base}/events/${this.eventId}/documents`).subscribe({
      next: docs => this.documents.set(docs),
      error: () => this.error.set('Could not load event documents'),
    });
  }
  upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { this.error.set('Maximum file size is 15 MB'); input.value = ''; return; }
    const body = new FormData();
    body.append('file', file);
    body.append('category', this.documentCategory);
    this.busy.set(true); this.error.set('');
    this.http.post(`${this.base}/events/${this.eventId}/documents`, body).subscribe({
      next: () => {
        this.busy.set(false); input.value = '';
        this.feedback.set('Document uploaded'); this.loadDocuments();
      },
      error: () => { this.busy.set(false); input.value = ''; this.error.set('Document upload failed'); },
    });
  }
  download(doc: EventDocument) {
    this.http.get(`${this.base}/events/${this.eventId}/documents/${doc.id}/download`,
      { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = doc.originalName; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.error.set('Document download failed'),
    });
  }
  remove(doc: EventDocument) {
    if (!window.confirm(`Remove document ${doc.originalName}?`)) return;
    this.http.delete(`${this.base}/events/${this.eventId}/documents/${doc.id}`).subscribe({
      next: () => { this.feedback.set('Document removed'); this.loadDocuments(); },
      error: () => this.error.set('Could not remove document'),
    });
  }

  loadReport() {
    this.http.get<PostEventReport | null>(`${this.base}/events/${this.eventId}/report`).subscribe({
      next: value => {
        this.report = value ? {
          attendance: value.attendance, summary: value.summary,
          successes: value.successes, problems: value.problems,
          missingEquipment: value.missingEquipment, lessonsLearned: value.lessonsLearned,
          nextActions: value.nextActions,
        } : this.emptyReport();
        this.reportReady.set(true); this.reportSaved.set(Boolean(value));
      },
      error: () => this.error.set('Could not load post-event report'),
    });
  }

  saveReport() {
    this.error.set(''); this.busy.set(true);
    const body = { ...this.report, attendance: this.report.attendance === null || this.report.attendance === ('' as unknown as number)
      ? null : Number(this.report.attendance) };
    this.http.put<PostEventReport>(`${this.base}/events/${this.eventId}/report`, body).subscribe({
      next: () => {
        this.busy.set(false); this.reportSaved.set(true);
        this.feedback.set('Post-event report saved');
      },
      error: () => { this.busy.set(false); this.error.set('Could not save report'); },
    });
  }
  printReport() {
    this.tab.set('report');
    window.print();
  }
}
