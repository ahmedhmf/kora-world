import { Component, OnInit, inject, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownOptionsService } from '../../core/services/dropdown-options.service';
import { DropdownOption } from '../../core/models/dropdown-option.model';

interface CategoryConfig {
  key: string;
  label: string;
  description: string;
  placeholder: string;
}

@Component({
  selector: 'app-dropdown-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dropdown-settings.component.html',
})
export class DropdownSettingsComponent implements OnInit {
  private readonly optionsService = inject(DropdownOptionsService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly categories: CategoryConfig[] = [
    { key: 'currency', label: 'Currency', description: 'Product base currencies (e.g. USD, EUR, EGP).', placeholder: 'e.g. GBP' },
    { key: 'backing', label: 'Backing', description: 'Ball construction backing layers.', placeholder: 'e.g. 4 layers poly-cotton' },
    { key: 'bladder', label: 'Bladder', description: 'Ball construction bladders.', placeholder: 'e.g. Latex bladder' },
    { key: 'coverMaterial', label: 'Cover Material', description: 'Outer cover material options.', placeholder: 'e.g. PU leather' },
    { key: 'bonding', label: 'Bonding', description: 'Panel bonding methods.', placeholder: 'e.g. thermal bonding' },
    { key: 'pricepoint', label: 'Pricepoint', description: 'Market category segments.', placeholder: 'e.g. Match Pro' },
  ];

  selectedCategory = signal<CategoryConfig>(this.categories[0]);
  options = signal<DropdownOption[]>([]);
  loading = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  newValue = '';
  editingId: number | null = null;
  editingValue = '';

  ngOnInit(): void {
    this.loadOptions();
  }

  selectCategory(category: CategoryConfig): void {
    this.selectedCategory.set(category);
    this.newValue = '';
    this.cancelEdit();
    this.error.set(null);
    this.successMessage.set(null);
    this.loadOptions();
  }

  loadOptions(): void {
    this.loading.set(true);
    this.optionsService.getOptions(this.selectedCategory().key).subscribe({
      next: (data) => {
        this.options.set(data);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error.set('Failed to load dropdown options.');
        this.loading.set(false);
        console.error('Error loading options:', err);
        this.cdr.detectChanges();
      }
    });
  }

  addOption(): void {
    const value = this.newValue.trim();
    if (!value) return;

    this.submitting.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.optionsService.createOption({
      category: this.selectedCategory().key,
      value
    }).subscribe({
      next: (created) => {
        this.newValue = '';
        this.submitting.set(false);
        this.successMessage.set(`Option "${created.value}" added successfully.`);
        this.loadOptions();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to add option.');
        this.cdr.detectChanges();
      }
    });
  }

  startEdit(option: DropdownOption): void {
    this.editingId = option.id;
    this.editingValue = option.value;
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingValue = '';
    this.cdr.detectChanges();
  }

  saveEdit(id: number): void {
    const value = this.editingValue.trim();
    if (!value) return;

    this.submitting.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.optionsService.updateOption(id, {
      category: this.selectedCategory().key,
      value
    }).subscribe({
      next: (updated) => {
        this.editingId = null;
        this.editingValue = '';
        this.submitting.set(false);
        this.successMessage.set(`Option updated to "${updated.value}" successfully.`);
        this.loadOptions();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to update option.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteOption(id: number, value: string): void {
    if (!confirm(`Are you sure you want to delete the option "${value}"?`)) return;

    this.error.set(null);
    this.successMessage.set(null);

    this.optionsService.deleteOption(id).subscribe({
      next: () => {
        this.successMessage.set(`Option "${value}" deleted successfully.`);
        this.loadOptions();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to delete option.');
        this.cdr.detectChanges();
      }
    });
  }
}
