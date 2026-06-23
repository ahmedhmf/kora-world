import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ContactsStore } from '../../store/contacts.store';
import { Contact, ContactType } from '../../core/models/contact.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-contact-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './contact-detail.component.html',
})
export class ContactDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly store = inject(ContactsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  contact = signal<Contact | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loading.set(true);
        this.api.getContact(+id).subscribe({
          next: (c) => {
            this.contact.set(c);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set('Failed to load contact details.');
            this.loading.set(false);
            console.error(err);
          }
        });
      }
    });
  }

  async confirmDelete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Contact', 'Are you sure you want to delete this contact?');
    if (ok) {
      this.store.deleteContact(id);
      this.router.navigate(['/contacts']);
    }
  }

  getTypeClass(type: string): string {
    switch (type) {
      case 'marketing':
        return 'bg-purple-950/40 text-purple-400 border-purple-800/60';
      case 'legal':
        return 'bg-red-950/40 text-red-400 border-red-800/60';
      case 'finance':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'supplier':
        return 'bg-blue-950/40 text-blue-400 border-blue-800/60';
      case 'account':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'driver':
        return 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60';
      case 'warehouse':
        return 'bg-teal-950/40 text-teal-400 border-teal-800/60';
      default:
        return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60';
    }
  }

  getAvatarBg(type: string): string {
    switch (type) {
      case 'marketing':
        return 'bg-gradient-to-br from-purple-600 to-indigo-750';
      case 'legal':
        return 'bg-gradient-to-br from-red-600 to-rose-750';
      case 'finance':
        return 'bg-gradient-to-br from-emerald-600 to-teal-750';
      case 'supplier':
        return 'bg-gradient-to-br from-blue-600 to-sky-750';
      case 'account':
        return 'bg-gradient-to-br from-amber-600 to-orange-750';
      case 'driver':
        return 'bg-gradient-to-br from-cyan-600 to-blue-750';
      case 'warehouse':
        return 'bg-gradient-to-br from-teal-600 to-emerald-750';
      default:
        return 'bg-zinc-700';
    }
  }
}
