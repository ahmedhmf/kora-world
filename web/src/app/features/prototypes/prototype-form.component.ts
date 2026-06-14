import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PrototypesStore } from '../../store/prototypes.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreatePrototypeDto } from '../../core/models/prototype.model';

import { FileUploadComponent } from '../../shared/components/file-upload.component';

@Component({
  selector: 'app-prototype-form',
  standalone: true,
  imports: [FormsModule, RouterLink, FileUploadComponent],
  template: `
    <div class="p-8 max-w-2xl">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/prototypes" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block">← Back to Prototypes</a>
        <h1 class="text-2xl font-bold text-white">{{ isEdit() ? 'Edit Prototype' : 'New Prototype' }}</h1>
      </div>

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <form #protoForm="ngForm" (ngSubmit)="protoForm.valid && submit()" class="space-y-5">
        <div class="grid grid-cols-2 gap-5">

          <!-- Supplier (Required) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Supplier *</label>
            <select
              [(ngModel)]="form.supplierId" name="supplierId" required #supplierInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              [class.border-zinc-700]="!supplierInput.invalid || (!supplierInput.dirty && !supplierInput.touched)"
              [class.border-red-500]="supplierInput.invalid && (supplierInput.dirty || supplierInput.touched)"
            >
              <option [ngValue]="0" disabled>Select a supplier</option>
              @for (s of suppliersStore.suppliers(); track s.id) {
                <option [ngValue]="s.id">{{ s.name }}</option>
              }
            </select>
            @if (supplierInput.invalid && (supplierInput.dirty || supplierInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Supplier is required</p>
            }
          </div>

          <!-- Name / Label (Required) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Prototype Name / Title *</label>
            <input
              [(ngModel)]="form.name" name="name" required #nameInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!nameInput.invalid || (!nameInput.dirty && !nameInput.touched)"
              [class.border-red-500]="nameInput.invalid && (nameInput.dirty || nameInput.touched)"
              placeholder="e.g. Match Ball V2 - Latex Bladder Test"
            />
            @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Prototype Name is required</p>
            }
          </div>

          <!-- Category (Optional) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Category</label>
            <select
              [(ngModel)]="form.category" name="category"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
            >
              <option [ngValue]="undefined">Select category</option>
              <option value="football">Football</option>
              <option value="handball">Handball</option>
              <option value="lifestyle">Lifestyle</option>
            </select>
          </div>

          <!-- Status (Required) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Status *</label>
            <select
              [(ngModel)]="form.status" name="status" required #statusInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              [class.border-zinc-700]="!statusInput.invalid || (!statusInput.dirty && !statusInput.touched)"
              [class.border-red-500]="statusInput.invalid && (statusInput.dirty || statusInput.touched)"
            >
              <option value="requested">Requested</option>
              <option value="shipped">Shipped</option>
              <option value="received">Received</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            @if (statusInput.invalid && (statusInput.dirty || statusInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Status is required</p>
            }
          </div>

          <!-- Carrier (Optional) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Carrier</label>
            <input
              type="text"
              [(ngModel)]="form.carrier" name="carrier"
              placeholder="e.g. DHL, Fedex, UPS"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
          </div>

          <!-- Tracking Number (Optional) -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Tracking Number</label>
            <input
              type="text"
              [(ngModel)]="form.trackingNumber" name="trackingNumber"
              placeholder="e.g. 1Z999AA10123456784"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
          </div>

          <!-- Comments (Optional) -->
          <div class="col-span-2">
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Comments / Evaluation Notes</label>
            <textarea
              [(ngModel)]="form.comments" name="comments" rows="3"
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
              placeholder="Record feedback, test performance, or reasons for approval/rejection..."
            ></textarea>
          </div>

          <!-- Tech Pack File (Optional) -->
          <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
            <app-file-upload
              label="Digital Tech Pack Spec Sheet"
              [filePath]="form.techPackPath || ''"
              [fileName]="form.techPackName || ''"
              (fileUploaded)="onTechPackUploaded($event)"
              (fileRemoved)="onTechPackRemoved()"
            ></app-file-upload>
          </div>

          <!-- Construction Details (Only for Balls - Football/Handball) -->
          @if (form.category === 'football' || form.category === 'handball') {
            <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
              <div class="flex justify-between items-center mb-4">
                <div>
                  <h3 class="text-sm font-semibold text-white">Prototype Construction</h3>
                  <p class="text-zinc-500 text-xs mt-0.5">Define specifications for the ball prototype.</p>
                </div>
                <button
                  type="button"
                  (click)="addConstructionPair()"
                  class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-colors"
                >
                  + Add Detail
                </button>
              </div>

              @for (pair of constructionPairs; track $index) {
                <div class="flex gap-3 mb-3 items-center">
                  <input
                    type="text"
                    [(ngModel)]="pair.key"
                    [name]="'constKey_' + $index"
                    required
                    placeholder="Specification (e.g. Panels, Bladder)"
                    class="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                  <input
                    type="text"
                    [(ngModel)]="pair.value"
                    [name]="'constVal_' + $index"
                    required
                    placeholder="Value (e.g. 32, Latex bladder)"
                    class="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                  <button
                    type="button"
                    (click)="removeConstructionPair($index)"
                    class="text-red-400 hover:text-red-300 text-xs font-semibold px-2 py-1.5 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              } @empty {
                <div class="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
                  <p class="text-zinc-500 text-xs">No construction details added yet.</p>
                  <button
                    type="button"
                    (click)="addConstructionPair()"
                    class="text-white hover:underline text-xs font-medium mt-1 inline-block"
                  >
                    Add the first specification
                  </button>
                </div>
              }
            </div>
          }

        </div>

        <!-- Submit & Cancel -->
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            [disabled]="store.loading() || protoForm.invalid"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Prototype' : 'Create Prototype') }}
          </button>
          <a
            routerLink="/prototypes"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  `,
})
export class PrototypeFormComponent implements OnInit {
  readonly store = inject(PrototypesStore);
  readonly suppliersStore = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  constructionPairs: { key: string; value: string }[] = [];

  form: CreatePrototypeDto = {
    supplierId: 0,
    name: '',
    category: undefined,
    status: 'requested',
    comments: '',
    techPackPath: '',
    techPackName: '',
    carrier: '',
    trackingNumber: '',
  };

  addConstructionPair(): void {
    this.constructionPairs.push({ key: '', value: '' });
  }

  removeConstructionPair(index: number): void {
    this.constructionPairs.splice(index, 1);
  }

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.editId.set(+id);
      this.api.getPrototype(+id).subscribe((proto) => {
        this.form = {
          supplierId: proto.supplierId,
          name: proto.name,
          category: proto.category,
          status: proto.status,
          comments: proto.comments || '',
          techPackPath: proto.techPackPath || '',
          techPackName: proto.techPackName || '',
          carrier: proto.carrier || '',
          trackingNumber: proto.trackingNumber || '',
        };
        // Populate construction pairs
        this.constructionPairs = Object.entries(proto.construction || {}).map(
          ([key, value]) => ({ key, value })
        );
      });
    }
  }

  submit(): void {
    if (!this.form.name || !this.form.supplierId) return;

    // Filter empty strings and invalid numeric values
    const dto = Object.fromEntries(
      Object.entries(this.form).filter(([_, v]) => v !== '' && v !== null && v !== undefined && v !== 0)
    ) as CreatePrototypeDto;

    dto.supplierId = this.form.supplierId;

    // Serialize construction pairs if category is football or handball
    if (this.form.category === 'football' || this.form.category === 'handball') {
      const constructionObj: Record<string, string> = {};
      for (const pair of this.constructionPairs) {
        if (pair.key.trim()) {
          constructionObj[pair.key.trim()] = pair.value;
        }
      }
      dto.construction = Object.keys(constructionObj).length > 0 ? constructionObj : (null as any);
    } else {
      dto.construction = null as any;
    }

    if (this.isEdit() && this.editId()) {
      this.store.updatePrototype({ id: this.editId()!, dto });
    } else {
      this.store.createPrototype(dto);
    }

    this.router.navigate(['/prototypes']);
  }

  onTechPackUploaded(file: { path: string; name: string }): void {
    this.form.techPackPath = file.path;
    this.form.techPackName = file.name;
  }

  onTechPackRemoved(): void {
    this.form.techPackPath = '';
    this.form.techPackName = '';
  }
}
