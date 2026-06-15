import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SamplesStore } from '../../store/samples.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateSampleDto } from '../../core/models/sample.model';

import { FileUploadComponent } from '../../shared/components/file-upload.component';

@Component({
  selector: 'app-sample-form',
  standalone: true,
  imports: [FormsModule, RouterLink, FileUploadComponent],
  template: `
    <div class="p-8 max-w-2xl">

      <!-- Header -->
      <div class="mb-8">
        <a routerLink="/samples" class="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block">← Back to Samples</a>
        <h1 class="text-2xl font-bold text-white">
          {{ isEdit() ? 'Edit Sample' : 'New Sample' }}
          @if (form.roundNumber && form.roundNumber > 1) {
            <span class="ml-2 text-sm font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-0.5 rounded">
              Round {{ form.roundNumber }}
            </span>
          }
        </h1>
        @if (form.parentSampleId) {
          <div class="text-zinc-500 text-xs mt-2 select-none">
            ← Next round of: <a [routerLink]="['/samples', form.parentSampleId]" class="text-zinc-400 hover:text-zinc-300 underline">Previous Round (Round {{ (form.roundNumber || 1) - 1 }})</a>
          </div>
        }
      </div>

      <!-- Error -->
      @if (store.error()) {
        <div class="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {{ store.error() }}
        </div>
      }

      <form #sampleForm="ngForm" (ngSubmit)="sampleForm.valid && submit()" class="space-y-5">
        
        <!-- Article Number (Read-only, Edit Mode Only) -->
        @if (isEdit() && form.articleNumber) {
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between text-sm mb-4">
            <div>
              <span class="block text-zinc-500 font-medium mb-0.5">Article Number</span>
              <span class="text-white font-bold font-mono tracking-wider text-base">{{ form.articleNumber }}</span>
            </div>
            <span class="text-[10px] uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-0.5 rounded font-semibold tracking-wider select-none">
              Auto-Generated
            </span>
          </div>
        }

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
            <label class="block text-sm font-medium text-zinc-400 mb-1.5">Sample Name / Title *</label>
            <input
              [(ngModel)]="form.name" name="name" required #nameInput="ngModel"
              class="w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              [class.border-zinc-700]="!nameInput.invalid || (!nameInput.dirty && !nameInput.touched)"
              [class.border-red-500]="nameInput.invalid && (nameInput.dirty || nameInput.touched)"
              placeholder="e.g. Match Ball V2 - Latex Bladder Test"
            />
            @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
              <p class="text-red-500 text-xs mt-1.5">Sample Name is required</p>
            }
          </div>

          <!-- Collection, Year, Category and Preview (Create Mode Only) -->
          @if (!isEdit()) {
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Collection *</label>
              <select
                [(ngModel)]="form.collection" name="collection" required
                (change)="updateArticleNumberPreview()"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="" disabled>Select collection</option>
                <option value="SS">SS (Spring/Summer)</option>
                <option value="FW">FW (Fall/Winter)</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Year *</label>
              <input
                [(ngModel)]="form.year" name="year" type="number" required
                (input)="updateArticleNumberPreview()"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                placeholder="e.g. 2026"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Category *</label>
              <select
                [(ngModel)]="form.category" name="category" required
                (change)="updateArticleNumberPreview()"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-zinc-500"
              >
                <option [ngValue]="undefined" disabled>Select category</option>
                <option value="football">Football</option>
                <option value="handball">Handball</option>
                <option value="lifestyle">Lifestyle</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Article Number Preview</label>
              <input
                [value]="articleNumberPreview()"
                readonly
                disabled
                class="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg px-4 py-2.5 text-sm select-all"
              />
            </div>
          } @else {
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1.5">Category</label>
              <select
                [(ngModel)]="form.category" name="category" disabled
                class="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
              >
                <option [ngValue]="undefined">Select category</option>
                <option value="football">Football</option>
                <option value="handball">Handball</option>
                <option value="lifestyle">Lifestyle</option>
              </select>
            </div>
          }

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

          <!-- Ball Construction Details (Football & Handball only) -->
          @if (form.category === 'football' || form.category === 'handball') {
            <div class="col-span-2 border-t border-zinc-800 pt-5 mt-2">
              <h3 class="text-sm font-semibold text-white mb-4">Construction Details</h3>
              <div class="grid grid-cols-2 gap-4">

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Backing</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.backing" name="backing"
                    placeholder="e.g. 4 layers poly-cotton"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Bladder</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.bladder" name="bladder"
                    placeholder="e.g. SR bladder, Latex bladder"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Cover Material</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.coverMaterial" name="coverMaterial"
                    placeholder="e.g. PU leather, TPU"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Cutting Die / Panels</label>
                  <input
                    type="number" step="0.01" [(ngModel)]="ballConstruction.cuttingDiePanels" name="cuttingDiePanels"
                    placeholder="e.g. 32.00"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Number of Colors</label>
                  <input
                    type="number" step="1" [(ngModel)]="ballConstruction.numberOfColors" name="numberOfColors"
                    placeholder="e.g. 3"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Bonding</label>
                  <select
                    [(ngModel)]="ballConstruction.bonding" name="bonding"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">Select bonding</option>
                    <option value="machine stitched">Machine Stitched</option>
                    <option value="hand stitched">Hand Stitched</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="thermal bonding">Thermal Bonding</option>
                  </select>
                </div>

                <div class="col-span-2">
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">Carcass</label>
                  <input
                    type="text" [(ngModel)]="ballConstruction.carcass" name="carcass"
                    placeholder="e.g. Wound carcass"
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  />
                </div>

                <div class="flex items-center space-x-3 py-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="ballConstruction.debossing"
                    name="debossing"
                    id="debossingCheckbox"
                    class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label for="debossingCheckbox" class="text-sm font-medium text-zinc-400 cursor-pointer select-none">
                    Debossing
                  </label>
                </div>

                <div class="flex items-center space-x-3 py-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="ballConstruction.finishes"
                    name="finishes"
                    id="finishesCheckbox"
                    class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label for="finishesCheckbox" class="text-sm font-medium text-zinc-400 cursor-pointer select-none">
                    Finishes
                  </label>
                </div>

              </div>
            </div>
          }

        </div>

        <!-- Submit & Cancel -->
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            [disabled]="store.loading() || sampleForm.invalid"
            class="px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            {{ store.loading() ? 'Saving...' : (isEdit() ? 'Update Sample' : 'Create Sample') }}
          </button>
          <a
            routerLink="/samples"
            class="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  `,
})
export class SampleFormComponent implements OnInit {
  readonly store = inject(SamplesStore);
  readonly suppliersStore = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  ballConstruction = {
    backing: '',
    bladder: '',
    coverMaterial: '',
    cuttingDiePanels: null as number | null,
    numberOfColors: null as number | null,
    bonding: '',
    debossing: false,
    finishes: false,
    carcass: ''
  };

  loadConstruction(construction?: Record<string, any>): void {
    if (!construction) return;
    this.ballConstruction = {
      backing: String(construction['Backing'] || ''),
      bladder: String(construction['Bladder'] || ''),
      coverMaterial: String(construction['Cover Material'] || ''),
      cuttingDiePanels: construction['Cutting Die / Panels'] ? parseFloat(String(construction['Cutting Die / Panels'])) : null,
      numberOfColors: construction['Number of Colors'] ? parseInt(String(construction['Number of Colors']), 10) : null,
      bonding: String(construction['Bonding'] || ''),
      debossing: construction['Debossing'] === 'Yes',
      finishes: construction['Finishes'] === 'Yes',
      carcass: String(construction['Carcass'] || '')
    };
  }

  serializeConstruction(): Record<string, string | number> | null {
    const obj: Record<string, string | number> = {};
    if (this.ballConstruction.backing) obj['Backing'] = this.ballConstruction.backing;
    if (this.ballConstruction.bladder) obj['Bladder'] = this.ballConstruction.bladder;
    if (this.ballConstruction.coverMaterial) obj['Cover Material'] = this.ballConstruction.coverMaterial;
    if (this.ballConstruction.cuttingDiePanels !== null) obj['Cutting Die / Panels'] = this.ballConstruction.cuttingDiePanels;
    if (this.ballConstruction.numberOfColors !== null) obj['Number of Colors'] = this.ballConstruction.numberOfColors;
    if (this.ballConstruction.bonding) obj['Bonding'] = this.ballConstruction.bonding;
    obj['Debossing'] = this.ballConstruction.debossing ? 'Yes' : 'No';
    obj['Finishes'] = this.ballConstruction.finishes ? 'Yes' : 'No';
    if (this.ballConstruction.carcass) obj['Carcass'] = this.ballConstruction.carcass;

    return Object.keys(obj).length > 0 ? obj : null;
  }

  readonly articleNumberPreview = signal<string>('Pending required fields...');

  form = {
    supplierId: 0,
    name: '',
    category: undefined as any,
    status: 'requested' as any,
    comments: '',
    techPackPath: '',
    techPackName: '',
    carrier: '',
    trackingNumber: '',
    parentSampleId: null as number | null,
    roundNumber: 1,
    articleNumber: '',
    collection: '',
    year: new Date().getFullYear(),
  };



  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        forkJoin({
          suppliers: this.api.getSuppliers(),
          sample: this.api.getSample(+id)
        }).subscribe({
          next: ({ suppliers, sample }) => {
            this.suppliersStore.setSuppliers(suppliers);
             this.form = {
              supplierId: sample.supplierId,
              name: sample.name,
              category: sample.category,
              status: sample.status,
              comments: sample.comments || '',
              techPackPath: sample.techPackPath || '',
              techPackName: sample.techPackName || '',
              carrier: sample.carrier || '',
              trackingNumber: sample.trackingNumber || '',
              parentSampleId: sample.parentSampleId || null,
              roundNumber: sample.roundNumber || 1,
              articleNumber: sample.articleNumber || '',
              collection: sample.collection || '',
              year: sample.year || new Date().getFullYear()
            };
            // Populate construction details
            this.loadConstruction(sample.construction);
            this.cdr.detectChanges();
          },
          error: (err) => console.error('SampleForm: error loading data:', err)
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          supplierId: 0,
          name: '',
          category: undefined,
          status: 'requested',
          comments: '',
          techPackPath: '',
          techPackName: '',
          carrier: '',
          trackingNumber: '',
          parentSampleId: null,
          roundNumber: 1,
          articleNumber: '',
          collection: '',
          year: new Date().getFullYear(),
        };
        this.articleNumberPreview.set('Pending required fields...');
        this.ballConstruction = {
          backing: '',
          bladder: '',
          coverMaterial: '',
          cuttingDiePanels: null,
          numberOfColors: null,
          bonding: '',
          debossing: false,
          finishes: false,
          carcass: ''
        };

        // Check if prefilling from a parent sample
        const fromParentSampleId = this.route.snapshot.queryParamMap.get('fromParentSampleId');
        if (fromParentSampleId) {
          forkJoin({
            suppliers: this.api.getSuppliers(),
            parentSample: this.api.getSample(+fromParentSampleId)
          }).subscribe({
            next: ({ suppliers, parentSample }) => {
              this.suppliersStore.setSuppliers(suppliers);
              this.form = {
                supplierId: parentSample.supplierId,
                name: parentSample.name,
                category: parentSample.category,
                status: 'requested',
                comments: '',
                techPackPath: parentSample.techPackPath || '',
                techPackName: parentSample.techPackName || '',
                carrier: '',
                trackingNumber: '',
                parentSampleId: parentSample.id,
                roundNumber: (parentSample.roundNumber || 1) + 1,
                articleNumber: '',
                collection: parentSample.collection || '',
                year: parentSample.year || new Date().getFullYear(),
              };
              this.updateArticleNumberPreview();
              // Populate construction details
              this.loadConstruction(parentSample.construction);
              this.cdr.detectChanges();
            },
            error: (err) => console.error('SampleForm: error loading parent sample:', err)
          });
        } else {
          this.api.getSuppliers().subscribe({
            next: (suppliers) => {
              this.suppliersStore.setSuppliers(suppliers);
              this.cdr.detectChanges();
            },
            error: (err) => console.error('SampleForm: error loading suppliers:', err)
          });
        }
      }
    });
  }

  updateArticleNumberPreview(): void {
    const col = this.form.collection;
    const yr = this.form.year;
    const cat = this.form.category;

    if (!col || !yr || !cat) {
      this.articleNumberPreview.set('Pending required fields...');
      return;
    }

    const yearStr = String(yr).slice(-2);
    let catCode = 'OTH';
    if (cat === 'football') catCode = 'FB';
    else if (cat === 'handball') catCode = 'HB';
    else if (cat === 'lifestyle') catCode = 'APP';

    this.api.getSampleNextCounter(col, yr, cat).subscribe({
      next: (res) => {
        const counterStr = String(res.counter).padStart(4, '0');
        this.articleNumberPreview.set(`SP${col}${yearStr}${counterStr}${catCode}`);
      },
      error: () => {
        this.articleNumberPreview.set(`SP${col}${yearStr}????${catCode}`);
      }
    });
  }

  submit(): void {
    if (!this.form.name || !this.form.supplierId) return;
    if (!this.isEdit() && (!this.form.collection || !this.form.year || !this.form.category)) return;

    // Filter empty strings and invalid numeric values
    const dto = Object.fromEntries(
      Object.entries(this.form).filter(([_, v]) => v !== '' && v !== null && v !== undefined && v !== 0)
    ) as unknown as CreateSampleDto;

    dto.supplierId = this.form.supplierId;
    if (this.form.parentSampleId) {
      dto.parentSampleId = this.form.parentSampleId;
    }
    dto.roundNumber = this.form.roundNumber || 1;
    if (this.form.collection) dto.collection = this.form.collection;
    if (this.form.year) dto.year = this.form.year;

    // Serialize construction if category is football or handball
    if (this.form.category === 'football' || this.form.category === 'handball') {
      dto.construction = this.serializeConstruction() as any;
    } else {
      dto.construction = null as any;
    }

    if (this.isEdit() && this.editId()) {
      this.store.updateSample({ id: this.editId()!, dto });
    } else {
      this.store.createSample(dto);
    }

    this.router.navigate(['/samples']);
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
