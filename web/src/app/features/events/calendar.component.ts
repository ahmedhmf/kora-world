import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventsStore } from '../../store/events.store';
import { CalendarEvent, EventCategory } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Event Calendar</h1>
          <p class="text-zinc-400 text-sm mt-1">Schedule and manage sports matches, trade shows, and company cultural events.</p>
        </div>
        
        <!-- Quick Action Add Button -->
        <button
          (click)="openCreateDrawer(null)"
          class="px-5 py-2 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      <!-- Categories & Filters Bar -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-zinc-500 uppercase tracking-wider font-semibold mr-2">Filter Category:</span>
          
          @for (cat of categories; track cat.key) {
            <button
              (click)="toggleFilter(cat.key)"
              class="px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5"
              [class.bg-zinc-800]="!activeFilters()[cat.key]"
              [class.text-zinc-500]="!activeFilters()[cat.key]"
              [class.border-zinc-800]="!activeFilters()[cat.key]"
              [class]="activeFilters()[cat.key] ? cat.activeClass : ''"
            >
              <span class="w-1.5 h-1.5 rounded-full" [class]="cat.bulletClass"></span>
              {{ cat.label }}
            </button>
          }
        </div>

        <div class="flex items-center gap-3">
          <!-- Calendar Month Navigators -->
          <button 
            (click)="changeMonth(-1)"
            class="p-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
            title="Previous Month"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <h2 class="text-base font-bold text-white uppercase tracking-wider min-w-[140px] text-center">
            {{ currentMonth() | date:'MMMM yyyy' }}
          </h2>

          <button 
            (click)="changeMonth(1)"
            class="p-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
            title="Next Month"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Main Calendar Grid Container -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        
        <!-- Weekdays Header Row -->
        <div class="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/80 text-zinc-500 font-bold uppercase tracking-wider text-[10px] text-center py-3">
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
          <div>Sun</div>
        </div>

        <!-- Days Grid -->
        <div class="grid grid-cols-7 gap-px bg-zinc-800">
          @for (day of calendarDays(); track day.date.toISOString()) {
            <div 
              (click)="openCreateDrawer(day.date)"
              class="bg-zinc-950 min-h-[120px] p-2 flex flex-col justify-between transition-colors group cursor-pointer hover:bg-zinc-900/50"
              [class.bg-zinc-950/40]="!day.isCurrentMonth"
            >
              <!-- Day Header -->
              <div class="flex justify-between items-start">
                <span 
                  class="text-xs font-semibold transition-colors"
                  [class.text-zinc-600]="!day.isCurrentMonth"
                  [class.text-zinc-400]="day.isCurrentMonth && !day.isToday"
                  [class.text-white]="day.isToday"
                >
                  @if (day.isToday) {
                    <span class="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md shadow-blue-900/30">
                      {{ day.date.getDate() }}
                    </span>
                  } @else {
                    {{ day.date.getDate() }}
                  }
                </span>
                
                @if (day.isToday) {
                  <span class="text-[9px] text-blue-400 font-bold uppercase tracking-wider">Today</span>
                }
              </div>

              <!-- Events Stack -->
              <div class="flex-1 mt-2 space-y-1 overflow-y-auto max-h-[80px] scrollbar-none">
                @for (event of day.events; track event.id) {
                  <button
                    type="button"
                    (click)="openEditDrawer(event, $event)"
                    class="w-full text-left text-[10px] font-semibold py-1 px-1.5 rounded border leading-tight transition-all truncate block cursor-pointer"
                    [class]="getCategoryClass(event.category)"
                    [title]="event.title + ' (' + (event.startDate | date:'HH:mm') + ')'"
                  >
                    <span class="mr-1">{{ getCategoryEmoji(event.category) }}</span>
                    <span>{{ event.title }}</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Slide-over Edit / Create Event Drawer Panel -->
      @if (isDrawerOpen()) {
        <!-- Backdrop Overlay -->
        <div 
          class="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity flex justify-end"
          (click)="closeDrawer()"
        >
          <!-- Drawer Sheet -->
          <div 
            class="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <!-- Form Body -->
            <div class="space-y-6">
              
              <!-- Drawer Header -->
              <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
                <h3 class="text-lg font-bold text-white">
                  {{ drawerMode() === 'create' ? 'Schedule New Event' : 'Edit Event Details' }}
                </h3>
                <button 
                  (click)="closeDrawer()"
                  class="text-zinc-400 hover:text-white p-1 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Form Inputs -->
              <form class="space-y-4 text-sm">
                <!-- Title -->
                <div>
                  <label class="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">Event Title *</label>
                  <input 
                    type="text" 
                    [(ngModel)]="formTitle" 
                    name="title"
                    class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm" 
                    placeholder="e.g. Friendly Match vs Suppliers"
                    required
                  />
                </div>

                <!-- Category -->
                <div>
                  <label class="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">Category *</label>
                  <select 
                    [(ngModel)]="formCategory" 
                    name="category"
                    class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm"
                  >
                    @for (cat of categories; track cat.key) {
                      <option [value]="cat.key">{{ cat.label }}</option>
                    }
                  </select>
                </div>

                <!-- Start Date -->
                <div>
                  <label class="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">Start Date & Time *</label>
                  <input 
                    type="datetime-local" 
                    [(ngModel)]="formStartDate" 
                    name="startDate"
                    class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm"
                    required
                  />
                </div>

                <!-- End Date -->
                <div>
                  <label class="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">End Date & Time (Optional)</label>
                  <input 
                    type="datetime-local" 
                    [(ngModel)]="formEndDate" 
                    name="endDate"
                    class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm"
                  />
                </div>

                <!-- Location -->
                <div>
                  <label class="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">Location / Venue</label>
                  <input 
                    type="text" 
                    [(ngModel)]="formLocation" 
                    name="location"
                    class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm" 
                    placeholder="e.g. Main Pitch / Hall B / Online"
                  />
                </div>

                <!-- Description -->
                <div>
                  <label class="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">Remarks & Details</label>
                  <textarea 
                    [(ngModel)]="formDescription" 
                    name="description"
                    rows="3"
                    class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm resize-none" 
                    placeholder="Add agenda items, guest lists, or details..."
                  ></textarea>
                </div>
              </form>
            </div>

            <!-- Drawer Footer Actions -->
            <div class="border-t border-zinc-800 pt-4 mt-6 flex justify-between gap-3">
              <div>
                @if (drawerMode() === 'edit') {
                  <button
                    type="button"
                    (click)="deleteEvent()"
                    class="px-4 py-2 bg-red-950/40 border border-red-800/80 hover:bg-red-900/40 text-red-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Delete Event
                  </button>
                }
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  (click)="closeDrawer()"
                  class="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  (click)="saveEvent()"
                  [disabled]="!formTitle || !formStartDate"
                  class="px-4 py-2 bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Event
                </button>
              </div>
            </div>

          </div>
        </div>
      }

    </div>
  `,
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
    const dateStr = this.formatLocalDate(date);
    return this.store.events().filter((e) => {
      if (!this.activeFilters()[e.category]) return false;
      try {
        const eDate = new Date(e.startDate);
        return this.formatLocalDate(eDate) === dateStr;
      } catch {
        return false;
      }
    });
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

  deleteEvent(): void {
    if (this.eventId === null) return;
    if (confirm('Are you sure you want to delete this event?')) {
      this.store.deleteEvent(this.eventId);
      this.closeDrawer();
    }
  }
}
