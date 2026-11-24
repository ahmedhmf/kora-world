import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventsStore } from '../../store/events.store';
import { CalendarEvent, EventCategory } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';
import { eventOccursOnLocalDay } from './event-date-range';
import { switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ExperiencesApiService, KoraExperience, PackingItem } from '../experiences/experiences-api.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink],
  templateUrl: './calendar.component.html',
  styles: [`
    /* Custom simple hide scrollbar */
    .scrollbar-none::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-none {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class CalendarComponent implements OnInit {
  readonly store = inject(EventsStore);
  readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly experiencesApi = inject(ExperiencesApiService);
  private readonly http = inject(HttpClient);
  readonly duplicating = signal(false);

  readonly experienceLibrary = signal<KoraExperience[]>([]);
  readonly eventExperienceIds = signal<number[]>([]);
  readonly eventPackingList = signal<PackingItem[]>([]);
  readonly experienceBusy = signal(false);
  readonly experienceError = signal('');
  readonly experienceSuccess = signal('');
  readonly experienceDirty = signal(false);
  readonly eventPackedCount = computed(() => this.eventPackingList().filter(item => item.packed).length);

  // Month navigation
  currentMonth = signal<Date>(new Date());

  // Category list and styles
  readonly categories = [
    { 
      key: 'football' as EventCategory, 
      label: 'Football', 
      emoji: '⚽',
      badgeClass: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/50 hover:bg-emerald-950/50',
      activeClass: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/50',
      bulletClass: 'bg-emerald-500'
    },
    { 
      key: 'handball' as EventCategory, 
      label: 'Handball', 
      emoji: '🤾',
      badgeClass: 'bg-blue-950/30 text-blue-400 border-blue-800/50 hover:bg-blue-950/50',
      activeClass: 'bg-blue-950/30 text-blue-400 border-blue-800/50',
      bulletClass: 'bg-blue-500'
    },
    { 
      key: 'cultural' as EventCategory, 
      label: 'Cultural Events', 
      emoji: '🎭',
      badgeClass: 'bg-fuchsia-950/30 text-fuchsia-400 border-fuchsia-800/50 hover:bg-fuchsia-950/50',
      activeClass: 'bg-fuchsia-950/30 text-fuchsia-400 border-fuchsia-800/50',
      bulletClass: 'bg-fuchsia-500'
    },
    { 
      key: 'trade_show' as EventCategory, 
      label: 'Trade Shows', 
      emoji: '🎪',
      badgeClass: 'bg-amber-950/30 text-amber-400 border-amber-800/50 hover:bg-amber-950/50',
      activeClass: 'bg-amber-950/30 text-amber-400 border-amber-800/50',
      bulletClass: 'bg-amber-500'
    },
    { 
      key: 'other' as EventCategory, 
      label: 'Other', 
      emoji: '📅',
      badgeClass: 'bg-zinc-800/40 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800/60',
      activeClass: 'bg-zinc-800/40 text-zinc-300 border-zinc-700/50',
      bulletClass: 'bg-zinc-400'
    }
  ];

  // Filters toggled map
  activeFilters = signal<Record<EventCategory, boolean>>({
    football: true,
    handball: true,
    cultural: true,
    trade_show: true,
    other: true
  });

  // Drawer Form state
  isDrawerOpen = signal<boolean>(false);
  drawerMode = signal<'create' | 'edit'>('create');

  eventId: number | null = null;
  formTitle = '';
  formDescription = '';
  formCategory: EventCategory = 'football';
  formStartDate = '';
  formEndDate = '';
  formLocation = '';

  // Generate days in the current selected month calendar grid
  calendarDays = computed(() => {
    const date = this.currentMonth();
    const year = date.getFullYear();
    const month = date.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Grid starts on Monday. firstDay.getDay() is 0 for Sun, 1 for Mon, etc.
    let startDayOfWeek = firstDay.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Convert Sunday to index 7

    const daysList = [];

    // Add padding days from the previous month
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i > 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDate - i + 1);
      daysList.push({
        date: d,
        isCurrentMonth: false,
        isToday: this.isSameDay(d, new Date()),
        events: this.getEventsForDate(d)
      });
    }

    // Add days of the current month
    const numDays = lastDay.getDate();
    for (let i = 1; i <= numDays; i++) {
      const d = new Date(year, month, i);
      daysList.push({
        date: d,
        isCurrentMonth: true,
        isToday: this.isSameDay(d, new Date()),
        events: this.getEventsForDate(d)
      });
    }

    // Pad remaining grid slots up to 42 cells (6 full rows)
    const totalSlots = 42;
    const remainingSlots = totalSlots - daysList.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      daysList.push({
        date: d,
        isCurrentMonth: false,
        isToday: this.isSameDay(d, new Date()),
        events: this.getEventsForDate(d)
      });
    }

    return daysList;
  });

  ngOnInit(): void {
    this.store.loadEvents();
  }

  changeMonth(step: number): void {
    const newMonth = new Date(this.currentMonth());
    newMonth.setMonth(newMonth.getMonth() + step);
    this.currentMonth.set(newMonth);
  }

  toggleFilter(key: EventCategory): void {
    this.activeFilters.update(filters => ({
      ...filters,
      [key]: !filters[key]
    }));
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    return this.store.events().filter((event) =>
      this.activeFilters()[event.category] &&
      eventOccursOnLocalDay(event.startDate, event.endDate, date),
    );
  }

  getCategoryClass(category: string): string {
    const matched = this.categories.find(c => c.key === category);
    return matched ? matched.badgeClass : 'bg-zinc-800 text-zinc-300 border-zinc-700/50';
  }

  getCategoryEmoji(category: string): string {
    const matched = this.categories.find(c => c.key === category);
    return matched ? matched.emoji : '📅';
  }

  openCreateDrawer(date: Date | null): void {
    this.clearExperiencePanel();
    this.drawerMode.set('create');
    this.eventId = null;
    this.formTitle = '';
    this.formDescription = '';
    this.formCategory = 'football';
    
    const targetDate = date ? new Date(date) : new Date();
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    this.formStartDate = `${y}-${m}-${d}T09:00`;
    
    this.formEndDate = `${y}-${m}-${d}T10:00`;
    this.formLocation = '';
    
    this.isDrawerOpen.set(true);
  }

  openEditDrawer(event: CalendarEvent, clickEvent: MouseEvent): void {
    clickEvent.stopPropagation(); // Avoid triggering openCreateDrawer on the day cell
    this.drawerMode.set('edit');
    this.eventId = event.id;
    this.loadEventExperiences(event.id);
    this.formTitle = event.title;
    this.formDescription = event.description || '';
    this.formCategory = event.category;
    this.formStartDate = this.toDatetimeLocalString(event.startDate);
    this.formEndDate = this.toDatetimeLocalString(event.endDate);
    this.formLocation = event.location || '';
    
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  private clearExperiencePanel(): void {
    this.eventExperienceIds.set([]);
    this.eventPackingList.set([]);
    this.experienceError.set('');
    this.experienceSuccess.set('');
    this.experienceDirty.set(false);
    this.experienceBusy.set(false);
  }

  private loadEventExperiences(eventId: number): void {
    this.clearExperiencePanel();
    this.experiencesApi.list().subscribe({
      next: list => {
        if (this.eventId === eventId && this.isDrawerOpen()) this.experienceLibrary.set(list);
      },
      error: () => this.experienceError.set('Could not load the Kora Experiences library.'),
    });
    this.experiencesApi.selected(eventId).subscribe({
      next: ids => { if (this.eventId === eventId) this.eventExperienceIds.set(ids); },
      error: () => this.experienceError.set('Could not load assigned experiences.'),
    });
    this.experiencesApi.checklist(eventId).subscribe({
      next: items => { if (this.eventId === eventId) this.eventPackingList.set(items); },
      error: () => this.experienceError.set('Could not load the event checklist.'),
    });
  }

  toggleEventExperience(id: number, checked: boolean): void {
    this.eventExperienceIds.update(ids =>
      checked ? [...new Set([...ids, id])] : ids.filter(value => value !== id),
    );
    this.experienceDirty.set(true);
    this.experienceSuccess.set('');
  }

  saveEventExperiences(): void {
    const id = this.eventId;
    if (id === null || this.experienceBusy()) return;
    this.experienceBusy.set(true);
    this.experienceError.set('');
    const ids = [...this.eventExperienceIds()];
    this.experiencesApi.assign(id, ids).pipe(
      switchMap(() => this.experiencesApi.generate(id)),
    ).subscribe({
      next: items => {
        if (this.eventId === id) {
          this.eventPackingList.set(items);
          this.experienceDirty.set(false);
          this.experienceSuccess.set('Experiences saved to this event. Packing checklist updated.');
        }
        this.experienceBusy.set(false);
      },
      error: () => {
        this.experienceError.set('Could not save event experiences. Please try again.');
        this.experienceBusy.set(false);
      },
    });
  }

  setEventItemPacked(item: PackingItem, packed: boolean): void {
    const id = this.eventId;
    if (id === null || this.experienceBusy()) return;
    this.experienceBusy.set(true);
    this.experiencesApi.setPacked(id, item.key, packed).subscribe({
      next: items => {
        if (this.eventId === id) this.eventPackingList.set(items);
        this.experienceBusy.set(false);
      },
      error: () => {
        this.experienceError.set('Could not update the packing checklist.');
        this.experienceBusy.set(false);
      },
    });
  }

  toDatetimeLocalString(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  saveEvent(): void {
    if (!this.formTitle || !this.formStartDate) return;

    const startDateIso = new Date(this.formStartDate).toISOString();
    const endDateIso = this.formEndDate ? new Date(this.formEndDate).toISOString() : undefined;

    const dto = {
      title: this.formTitle,
      description: this.formDescription || undefined,
      category: this.formCategory,
      startDate: startDateIso,
      endDate: endDateIso,
      location: this.formLocation || undefined
    };

    if (this.drawerMode() === 'create') {
      this.store.createEvent(dto);
    } else if (this.drawerMode() === 'edit' && this.eventId !== null) {
      this.store.updateEvent({ id: this.eventId, dto });
    }

    this.closeDrawer();
  }

  async duplicateEvent(): Promise<void> {
    if (this.eventId === null || this.duplicating()) return;
    const confirmed = await this.dialogService.confirm('Duplicate Event',
      'Create a new event one week later with the same setup and Kora Experiences? Packing flags will be reset. Offers, files and reports will not be copied.');
    if (!confirmed) return;
    const id = this.eventId;
    this.duplicating.set(true);
    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const base = local ? 'http://localhost:3000' : '/api';
    this.http.post<CalendarEvent>(`${base}/events/${id}/duplicate`, {}).subscribe({
      next: event => {
        this.duplicating.set(false);
        this.closeDrawer();
        this.currentMonth.set(new Date(event.startDate));
        this.store.loadEvents();
      },
      error: () => {
        this.duplicating.set(false);
        void this.dialogService.alert('Duplicate Event', 'Could not duplicate this event.');
      },
    });
  }

  async deleteEvent(): Promise<void> {
    if (this.eventId === null) return;
    const ok = await this.dialogService.confirm('Delete Event', 'Are you sure you want to delete this event?');
    if (ok) {
      this.store.deleteEvent(this.eventId);
      this.closeDrawer();
    }
  }
}
