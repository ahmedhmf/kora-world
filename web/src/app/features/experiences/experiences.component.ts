import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { ExperienceItem, ExperiencesApiService, KoraExperience, PackingItem } from './experiences-api.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-kora-experiences',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './experiences.component.html',
})
export class ExperiencesComponent implements OnInit {
  private readonly api = inject(ExperiencesApiService);
  private readonly eventsApi = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly experiences = signal<KoraExperience[]>([]);
  readonly selectedIds = signal<number[]>([]);
  readonly checklist = signal<PackingItem[]>([]);
  readonly eventTitle = signal('');
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly editing = signal(false);
  readonly packedCount = computed(() => this.checklist().filter(x => x.packed).length);
  eventId: number | null = null;
  editId: number | null = null;
  formName = '';
  formDescription = '';
  formActive = true;
  formItems: ExperienceItem[] = [];
  extra: ExperienceItem = this.blankItem();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.eventId = Number.isSafeInteger(id) && id > 0 ? id : null;
    this.loadLibrary();
    if (this.eventId !== null) {
      const eventId = this.eventId;
      this.eventsApi.getEvent(eventId).subscribe({
        next: event => this.eventTitle.set(event.title),
        error: () => this.error.set('Could not load this event'),
      });
      this.api.selected(eventId).subscribe({
        next: ids => this.selectedIds.set(ids),
        error: err => this.fail(err),
      });
      this.refreshChecklist();
    }
  }

  blankItem(): ExperienceItem {
    return { name: '', quantity: 1, unit: 'pcs', category: 'General', mode: 'sum' };
  }
  loadLibrary() {
    this.api.list().subscribe({ next: rows => this.experiences.set(rows), error: err => this.fail(err) });
  }
  startNew() {
    this.editId = null;
    this.formName = '';
    this.formDescription = '';
    this.formActive = true;
    this.formItems = [this.blankItem()];
    this.editing.set(true);
  }
  startEdit(value: KoraExperience) {
    this.editId = value.id;
    this.formName = value.name;
    this.formDescription = value.description || '';
    this.formActive = value.active;
    this.formItems = value.items.map(item => ({ ...item }));
    this.editing.set(true);
  }
  addRequirement() { this.formItems.push(this.blankItem()); }
  removeRequirement(index: number) { this.formItems.splice(index, 1); }
  saveExperience() {
    this.error.set('');
    if (!this.formName.trim() || this.formItems.some(i => !i.name.trim() || i.quantity < 1 || !Number.isSafeInteger(Number(i.quantity)))) {
      this.error.set('Enter an experience name and valid item names and quantities');
      return;
    }
    const dto = { name: this.formName.trim(), description: this.formDescription, active: this.formActive,
      items: this.formItems.map(item => ({ ...item, quantity: Number(item.quantity) })) };
    this.busy.set(true);
    const request = this.editId === null ? this.api.create(dto) : this.api.update(this.editId, dto);
    request.subscribe({
      next: () => { this.busy.set(false); this.editing.set(false); this.message.set('Experience saved'); this.loadLibrary(); },
      error: err => this.fail(err),
    });
  }
  removeExperience(value: KoraExperience) {
    if (!window.confirm(`Delete ${value.name}? Existing generated event checklists will be retained.`)) return;
    this.api.delete(value.id).subscribe({
      next: () => { this.message.set('Experience deleted'); this.loadLibrary(); },
      error: err => this.fail(err),
    });
  }
  toggleSelection(id: number, checked: boolean) {
    this.selectedIds.update(ids => checked ? [...ids.filter(x => x !== id), id] : ids.filter(x => x !== id));
    this.message.set('Selection changed. Generate the checklist to save it.');
  }
  generate() {
    if (this.eventId === null || this.busy()) return;
    const eventId = this.eventId;
    this.busy.set(true);
    this.error.set('');
    this.api.assign(eventId, this.selectedIds()).pipe(switchMap(() => this.api.generate(eventId))).subscribe({
      next: rows => {
        this.checklist.set(rows);
        this.message.set('Event checklist generated and saved');
        this.busy.set(false);
      },
      error: err => this.fail(err),
    });
  }
  refreshChecklist() {
    if (this.eventId === null) return;
    this.api.checklist(this.eventId).subscribe({
      next: rows => this.checklist.set(rows),
      error: err => this.fail(err),
    });
  }
  togglePacked(row: PackingItem, packed: boolean) {
    if (this.eventId === null) return;
    this.api.setPacked(this.eventId, row.key, packed).subscribe({
      next: rows => this.checklist.set(rows),
      error: err => this.fail(err),
    });
  }
  addExtra() {
    if (this.eventId === null || !this.extra.name.trim()) {
      this.error.set('Enter the additional item name');
      return;
    }
    this.busy.set(true);
    this.api.addEventItem(this.eventId, { ...this.extra, quantity: Number(this.extra.quantity) }).subscribe({
      next: rows => { this.checklist.set(rows); this.extra = this.blankItem(); this.busy.set(false); this.message.set('Event-only item added'); },
      error: err => this.fail(err),
    });
  }
  print() { window.print(); }
  private fail(err: any) {
    this.busy.set(false);
    const message = err?.error?.message;
    this.error.set(typeof message === 'string' ? message : Array.isArray(message) ? message.join(', ') : 'Unable to save. Please try again.');
  }
}
