import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Sample } from '../../core/models/sample.model';
import { SupplierContact } from '../../core/models/supplier.model';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-sample-receipt-protocol',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './sample-receipt-protocol.component.html',
  styles: [`
    @media print {
      .page-break {
        page-break-before: always;
      }
      body {
        background-color: white !important;
        color: black !important;
      }
      /* Clean white background and borders for tables */
      .print-container {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
        background-color: white !important;
        color: black !important;
      }
    }
  `]
})
export class SampleReceiptProtocolComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogService = inject(DialogService);

  sampleId = signal<number>(0);
  sample = signal<Sample | null>(null);
  saving = signal<boolean>(false);
  supplierContacts = signal<SupplierContact[]>([]);
  readonly uploadingIndex = signal<number | null>(null);
  readonly previewImageUrl = signal<string | null>(null);

  readonly qualityCriteria = [
    { key: 'coverMaterialFeel', label: 'Cover material feel' },
    { key: 'stitchingQuality', label: 'Stitching quality' },
    { key: 'panelAlignment', label: 'Panel alignment' },
    { key: 'printColorAccuracy', label: 'Print / colour accuracy' },
    { key: 'shapeRoundness', label: 'Shape & roundness' },
    { key: 'inflationAirRetention', label: 'Inflation & air retention' },
    { key: 'bounceReboundFeel', label: 'Bounce / rebound feel' },
    { key: 'surfaceGripTexture', label: 'Surface grip / texture' }
  ];

  protocol = {
    protocolNo: '',
    dateReceived: '',
    receivedBy: '',
    department: 'Quality Assurance',
    supplierInfo: {
      supplierName: '',
      country: '',
      contactPerson: '',
      orderPoNo: '',
      email: '',
      shipmentRef: ''
    },
    sampleDetails: {
      productType: '',
      productTypeOther: '',
      modelSku: '',
      qtyReceived: 1,
      sizeWeight: '',
      materialCover: '',
      colorDesign: '',
      productionStandard: {
        en71: false,
        fifa: false,
        fifaQualityPro: false,
        fifaQuality: false,
        fifaBasic: false,
        ihf: false,
        none: false,
        other: false,
        otherText: ''
      },
      resinCompatible: ''
    },
    packagingCondition: {
      outerCarton: '',
      individualPackaging: '',
      labelling: '',
      koraBranding: '',
      outerCartonNotes: '',
      individualPackagingNotes: '',
      labellingNotes: '',
      koraBrandingNotes: '',
      notes: ''
    },
    qualityCheck: {
      coverMaterialFeel: { rating: '', notes: '' },
      stitchingQuality: { rating: '', notes: '' },
      panelAlignment: { rating: '', notes: '' },
      printColorAccuracy: { rating: '', notes: '' },
      shapeRoundness: { rating: '', notes: '' },
      inflationAirRetention: { rating: '', notes: '' },
      bounceReboundFeel: { rating: '', notes: '' },
      surfaceGripTexture: { rating: '', notes: '' }
    } as Record<string, { rating: string; notes: string }>,
    specCompliance: {
      circumference: { measured: '', spec: '', status: '', notes: '' },
      weight: { measured: '', spec: '', status: '', notes: '' },
      pressure: { measured: '', spec: '', status: '', notes: '' },
      pantoneColor: { expected: '', received: '', status: '', notes: '' }
    },
    defectLog: [
      { category: '', description: '', severity: '', photoRef: '', photoPath: '', photoName: '' }
    ],
    overallVerdict: '',
    remarks: '',
    signOff: {
      checkedByName: '',
      checkedByDate: '',
      approvedByName: '',
      approvedByDate: ''
    }
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sampleId.set(+id);
        this.loadSampleData(+id);
      }
    });
  }

  getQC(key: string): { rating: string; notes: string } {
    return this.protocol.qualityCheck[key];
  }

  onProductTypeChange(): void {
    const type = this.protocol.sampleDetails.productType;
    if (type === 'Football') {
      this.protocol.sampleDetails.resinCompatible = '';
      this.protocol.sampleDetails.productionStandard.fifa = false;
      this.protocol.sampleDetails.productionStandard.ihf = false;
    } else if (type === 'Handball') {
      this.protocol.sampleDetails.productionStandard.fifa = false;
      this.protocol.sampleDetails.productionStandard.fifaQuality = false;
      this.protocol.sampleDetails.productionStandard.fifaQualityPro = false;
      this.protocol.sampleDetails.productionStandard.fifaBasic = false;
    } else {
      // T-Shirt or Other
      this.protocol.sampleDetails.resinCompatible = '';
      this.protocol.sampleDetails.productionStandard.en71 = false;
      this.protocol.sampleDetails.productionStandard.fifa = false;
      this.protocol.sampleDetails.productionStandard.fifaQuality = false;
      this.protocol.sampleDetails.productionStandard.fifaQualityPro = false;
      this.protocol.sampleDetails.productionStandard.fifaBasic = false;
      this.protocol.sampleDetails.productionStandard.ihf = false;
    }

    if (!this.protocol.sampleDetails.productionStandard.other) {
      this.protocol.sampleDetails.productionStandard.otherText = '';
    }
  }

  addDefectRow(): void {
    if (!this.protocol.defectLog) {
      this.protocol.defectLog = [];
    }
    this.protocol.defectLog = [
      ...this.protocol.defectLog,
      { category: '', description: '', severity: '', photoRef: '', photoPath: '', photoName: '' }
    ];
  }

  removeDefectRow(index: number): void {
    if (this.protocol.defectLog && this.protocol.defectLog.length > 0) {
      const copy = [...this.protocol.defectLog];
      copy.splice(index, 1);
      this.protocol.defectLog = copy;
    }
  }

  uploadDefectPhoto(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.uploadingIndex.set(index);
    this.api.uploadFile(file).subscribe({
      next: (res) => {
        const item = this.protocol.defectLog[index];
        item.photoPath = res.path;
        item.photoName = res.name;
        if (!item.photoRef || !item.photoRef.trim()) {
          item.photoRef = `IMG_${index + 1}`;
        }
        this.uploadingIndex.set(null);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error uploading defect photo:', err);
        this.dialogService.alert('Upload Failed', 'Failed to upload image. Please try again.');
        this.uploadingIndex.set(null);
        this.cdr.detectChanges();
      }
    });
  }

  removeDefectPhoto(index: number): void {
    const item = this.protocol.defectLog[index];
    item.photoPath = '';
    item.photoName = '';
    this.cdr.detectChanges();
  }

  getPublicUrl(path: string): string {
    return this.api.getPublicImageUrl(path);
  }

  openImagePreview(path: string): void {
    if (!path) return;
    this.previewImageUrl.set(this.getPublicUrl(path));
  }

  closeImagePreview(): void {
    this.previewImageUrl.set(null);
  }

  private loadSampleData(id: number): void {
    this.api.getSample(id).subscribe({
      next: (s) => {
        this.sample.set(s);
        const supplierContacts = s.supplier?.contacts || [];
        this.supplierContacts.set(supplierContacts);

        // Auto resolve contact from contacts list if available
        let contactPersonName = '';
        let contactPersonEmail = '';
        if (supplierContacts.length > 0) {
          const contactPersonObj = supplierContacts.find(c => c.sendInfo) || 
                                   supplierContacts.find(c => 
                                     c.role?.toLowerCase().includes('contact person') || 
                                     c.role?.toLowerCase() === 'contact'
                                   ) || 
                                   supplierContacts[0];

          contactPersonName = contactPersonObj.name || '';
          contactPersonEmail = contactPersonObj.email || '';
        }

        const shipmentRef = s.carrier && s.trackingNumber
          ? `${s.carrier} - ${s.trackingNumber}`
          : (s.trackingNumber || s.carrier || '');

        if (s.receiptProtocol) {
          // Load existing protocol values
          this.protocol = {
            ...this.protocol,
            ...JSON.parse(JSON.stringify(s.receiptProtocol))
          };
          // Ensure nested fields are initialized to avoid undefined errors in templates
          if (this.protocol.sampleDetails) {
            this.protocol.sampleDetails.productionStandard = Object.assign(
              {
                en71: false,
                fifa: false,
                fifaQualityPro: false,
                fifaQuality: false,
                fifaBasic: false,
                ihf: false,
                none: false,
                other: false,
                otherText: ''
              },
              this.protocol.sampleDetails.productionStandard
            );
          }
          if (this.protocol.packagingCondition) {
            this.protocol.packagingCondition = Object.assign(
              {
                outerCarton: '',
                individualPackaging: '',
                labelling: '',
                koraBranding: '',
                outerCartonNotes: '',
                individualPackagingNotes: '',
                labellingNotes: '',
                koraBrandingNotes: '',
                notes: ''
              },
              this.protocol.packagingCondition
            );
            // Migrate legacy packagingCondition.notes to outerCartonNotes if empty
            if (this.protocol.packagingCondition.notes && !this.protocol.packagingCondition.outerCartonNotes) {
              this.protocol.packagingCondition.outerCartonNotes = this.protocol.packagingCondition.notes;
            }
          }
          if (!this.protocol.defectLog || this.protocol.defectLog.length === 0) {
            this.protocol.defectLog = [
              { category: '', description: '', severity: '', photoRef: '', photoPath: '', photoName: '' }
            ];
          }
        } else {
          // Pre-fill default values from Sample details
          const todayStr = new Date().toISOString().substring(0, 10);
          
          this.protocol.protocolNo = s.articleNumber ? `KOR-${s.articleNumber}` : `KOR-SP-${s.id}`;
          this.protocol.dateReceived = todayStr;
          this.protocol.receivedBy = this.authService.currentUser()?.name || '';
          
          this.protocol.supplierInfo = {
            supplierName: s.supplier?.name || '',
            country: s.supplier?.country || '',
            contactPerson: '',
            orderPoNo: s.articleNumber || '',
            email: '',
            shipmentRef: ''
          };

          let pType = 'Other';
          let pTypeOther = '';
          if (s.category === 'football') {
            pType = 'Football';
          } else if (s.category === 'handball') {
            pType = 'Handball';
          } else if (s.category === 'lifestyle') {
            pType = 'T-Shirt';
          } else if (s.category) {
            pType = 'Other';
            pTypeOther = s.category;
          }

          this.protocol.sampleDetails = {
            productType: pType,
            productTypeOther: pTypeOther,
            modelSku: s.name || '',
            qtyReceived: 1,
            sizeWeight: '',
            materialCover: s.construction?.['Cover Material'] || '',
            colorDesign: '',
            productionStandard: {
              en71: false,
              fifa: false,
              fifaQualityPro: false,
              fifaQuality: false,
              fifaBasic: false,
              ihf: false,
              none: false,
              other: false,
              otherText: ''
            },
            resinCompatible: ''
          };

          this.protocol.signOff.checkedByName = this.authService.currentUser()?.name || '';
          this.protocol.signOff.checkedByDate = todayStr;
        }

        // Always sync/override with current sample supplier and contact info
        this.protocol.supplierInfo.supplierName = s.supplier?.name || '';
        this.protocol.supplierInfo.country = s.supplier?.country || '';
        this.protocol.supplierInfo.contactPerson = contactPersonName;
        this.protocol.supplierInfo.email = contactPersonEmail;
        this.protocol.supplierInfo.shipmentRef = shipmentRef;

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading sample for receipt protocol:', err)
    });
  }

  saveProtocol(): void {
    if (!this.sample()) return;
    this.saving.set(true);

    // Filter out completely empty defect log rows
    const cleanedProtocol = JSON.parse(JSON.stringify(this.protocol));
    if (cleanedProtocol.defectLog) {
      cleanedProtocol.defectLog = cleanedProtocol.defectLog.filter((item: any) => 
        item.category?.trim() || 
        item.description?.trim() || 
        item.severity?.trim() || 
        item.photoRef?.trim() ||
        item.photoPath?.trim()
      );
    }

    this.api.updateSample(this.sampleId(), {
      receiptProtocol: cleanedProtocol
    } as any).subscribe({
      next: async (updated) => {
        this.saving.set(false);
        this.sample.set(updated);
        await this.dialogService.alert('Success', 'Sample receipt protocol saved successfully!');
        this.router.navigate(['/samples', this.sampleId()]);
      },
      error: async (err) => {
        this.saving.set(false);
        console.error('Error saving receipt protocol:', err);
        await this.dialogService.alert('Save Failed', 'Could not save the protocol. Please try again.');
      }
    });
  }

  printProtocol(): void {
    window.print();
  }
}
