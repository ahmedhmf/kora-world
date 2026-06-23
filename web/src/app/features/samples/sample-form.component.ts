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
  templateUrl: './sample-form.component.html',
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
