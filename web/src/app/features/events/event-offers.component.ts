import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';

type OfferType = 'staff' | 'supplier';
type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
interface EventOffer {
  id: number;
  type: OfferType;
  recipientName: string;
  supplierId: number | null;
  description: string;
  quantity: number;
  unit: string;
  unitRateCents: string;
  totalCents: string;
  currency: string;
  status: OfferStatus;
  notes: string | null;
}
interface QuotationFile {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}
interface OfferForm {
  type: OfferType;
  recipientName: string;
  supplierId: number | null;
  description: string;
  quantity: number;
  unit: string;
  unitRate: string;
  currency: string;
  status: OfferStatus;
  notes: string;
}
@Component({
  selector: 'app-event-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './event-offers.component.html',
})
export class EventOffersComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private get base() {
    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return local ? 'http://localhost:3000' : '/api';
  }

  eventId = Number(this.route.snapshot.paramMap.get('id'));
  readonly eventTitle = signal('');
  readonly offers = signal<EventOffer[]>([]);
  readonly suppliers = signal<Array<{ id: number; name: string }>>([]);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly busy = signal(false);
  readonly editing = signal(false);
  readonly filesByOffer = signal<Record<number, QuotationFile[]>>({});
  readonly fileBusy = signal<number | null>(null);
  editId: number | null = null;
  form: OfferForm = this.blank();

  blank(type: OfferType = 'staff'): OfferForm {
    return { type, recipientName: '', supplierId: null, description: '', quantity: 1,
      unit: type === 'staff' ? 'days' : 'pcs', unitRate: '0.00', currency: 'EGP',
      status: 'draft', notes: '' };
  }

  ngOnInit() {
    if (!Number.isSafeInteger(this.eventId) || this.eventId < 1) {
      this.error.set('Invalid event ID');
      return;
    }
    this.api.getEvent(this.eventId).subscribe({
      next: event => this.eventTitle.set(event.title),
      error: () => this.error.set('Event not found'),
    });
    this.api.getSuppliers().subscribe({
      next: suppliers => this.suppliers.set(suppliers.map(s => ({ id: s.id, name: s.name }))),
    });
    this.load();
  }

  load() {
    this.http.get<EventOffer[]>(`${this.base}/events/${this.eventId}/offers`).subscribe({
      next: offers => {
        this.offers.set(offers);
        for (const offer of offers) if (offer.type === 'supplier') this.loadFiles(offer.id);
      },
      error: () => this.error.set('Unable to load event offers'),
    });
  }

  loadFiles(offerId: number) {
    this.http.get<QuotationFile[]>(`${this.base}/events/${this.eventId}/offers/${offerId}/files`).subscribe({
      next: files => this.filesByOffer.update(previous => ({ ...previous, [offerId]: files })),
      error: () => this.error.set('Could not load quotation attachments'),
    });
  }

  uploadQuote(offer: EventOffer, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      this.error.set('The maximum quotation file size is 15 MB');
      input.value = '';
      return;
    }
    this.error.set('');
    this.fileBusy.set(offer.id);
    const formData = new FormData();
    formData.append('file', file);
    this.http.post(`${this.base}/events/${this.eventId}/offers/${offer.id}/files`, formData).subscribe({
      next: () => {
        this.fileBusy.set(null);
        input.value = '';
        this.feedback.set('Supplier quotation document uploaded');
        this.loadFiles(offer.id);
      },
      error: err => {
        this.fileBusy.set(null);
        input.value = '';
        const message = err?.error?.message;
        this.error.set(typeof message === 'string' ? message : 'Could not upload quotation document');
      },
    });
  }

  downloadQuote(offerId: number, file: QuotationFile) {
    this.http.get(`${this.base}/events/${this.eventId}/offers/${offerId}/files/${file.id}/download`,
      { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.originalName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.error.set('Could not download quotation document'),
    });
  }

  deleteQuote(offerId: number, file: QuotationFile) {
    if (!window.confirm(`Remove attached file ${file.originalName}?`)) return;
    this.http.delete(`${this.base}/events/${this.eventId}/offers/${offerId}/files/${file.id}`).subscribe({
      next: () => { this.feedback.set('Attachment removed'); this.loadFiles(offerId); },
      error: () => this.error.set('Could not remove attachment'),
    });
  }

  start(type: OfferType) { this.form = this.blank(type); this.editId = null; this.editing.set(true); this.error.set(''); }
  edit(offer: EventOffer) {
    this.editId = offer.id;
    this.form = {
      type: offer.type, recipientName: offer.recipientName, supplierId: offer.supplierId,
      description: offer.description, quantity: offer.quantity, unit: offer.unit,
      unitRate: this.money(offer.unitRateCents), currency: offer.currency,
      status: offer.status, notes: offer.notes ?? '',
    };
    this.editing.set(true);
    this.error.set('');
  }

  selectSupplier(value: string) {
    const id = Number(value);
    const supplier = this.suppliers().find(row => row.id === id);
    this.form.supplierId = supplier?.id ?? null;
    if (supplier) this.form.recipientName = supplier.name;
  }

  money(cents: string): string {
    const numeric = BigInt(cents);
    return `${numeric / 100n}.${String(numeric % 100n).padStart(2, '0')}`;
  }

  save() {
    this.error.set('');
    if (this.busy()) return;
    const body = { ...this.form, supplierId: this.form.type === 'supplier' ? this.form.supplierId : null,
      quantity: Number(this.form.quantity), unitRate: this.form.unitRate.trim() };
    if (!body.recipientName.trim() || !body.description.trim() || !body.unit.trim() ||
      !Number.isSafeInteger(body.quantity) || body.quantity < 1 ||
      !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(body.unitRate)) {
      this.error.set('Enter a name, service, valid quantity and a rate with up to two decimals.');
      return;
    }
    this.busy.set(true);
    const url = `${this.base}/events/${this.eventId}/offers`;
    const request = this.editId === null
      ? this.http.post<EventOffer>(url, body)
      : this.http.put<EventOffer>(`${url}/${this.editId}`, body);
    request.subscribe({
      next: () => { this.busy.set(false); this.editing.set(false); this.feedback.set('Offer saved to event'); this.load(); },
      error: err => {
        this.busy.set(false);
        const m = err?.error?.message;
        this.error.set(typeof m === 'string' ? m : 'Could not save offer');
      },
    });
  }

  remove(offer: EventOffer) {
    if (!window.confirm(`Delete offer for ${offer.recipientName}?`)) return;
    this.http.delete(`${this.base}/events/${this.eventId}/offers/${offer.id}`).subscribe({
      next: () => { this.feedback.set('Offer deleted'); this.load(); },
      error: () => this.error.set('Could not delete offer'),
    });
  }
}
