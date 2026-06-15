import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Sample } from '../../core/models/sample.model';
import { SupplierContact } from '../../core/models/supplier.model';

@Component({
  selector: 'app-sample-receipt-protocol',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="p-8 max-w-5xl mx-auto print-container">
      
      <!-- Top Action Bar (Online Only) -->
      <div class="flex items-center justify-between mb-8 print:hidden">
        <div>
          <a [routerLink]="['/samples', sampleId()]" class="text-zinc-500 hover:text-zinc-300 text-sm mb-2 inline-block">← Back to Sample Details</a>
          <h1 class="text-2xl font-bold text-white">Sample Receipt Protocol</h1>
        </div>
        <div class="flex space-x-3">
          <button
            (click)="printProtocol()"
            class="px-4 py-2 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 text-sm font-semibold rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Export PDF / Print
          </button>
          <button
            (click)="saveProtocol()"
            [disabled]="saving()"
            class="px-5 py-2 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {{ saving() ? 'Saving...' : 'Save Protocol' }}
          </button>
        </div>
      </div>

      <!-- Main Protocol Sheet -->
      <div class="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-8 print:bg-white print:text-black print:border-none print:p-0 print:m-0">
        
        <!-- Document Header (Logo & Title) -->
        <div class="flex items-center justify-between border-b-2 border-zinc-800 pb-5 mb-6 print:border-black">
          <div class="flex items-center">
            <!-- Brand SVG Logo (Reuses the layout's logo style) -->
            <div>
              <svg width="140" height="30" viewBox="0 0 224 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white print:text-black">
                <g clip-path="url(#clip0_105_44)">
                  <path d="M69.71 15.16L65.85 27.04C65.16 29.17 66.75 31.36 68.99 31.36H93.17H97.19C98.8 31.36 100.23 30.32 100.73 28.79L106.39 11.37C106.81 10.08 105.85 8.75 104.49 8.75H78.53C74.51 8.75 70.95 11.34 69.71 15.16ZM73.35 24.88L75.6 17.84C76.11 16.25 77.58 15.18 79.25 15.18H96.57C97.48 15.18 98.13 16.07 97.85 16.94L95.28 24.89H73.36L73.35 24.88Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M118.63 0.5L107.89 33.47C106.68 37.18 103.23 39.68 99.33 39.68L65.43 39.63C59.34 39.63 55.02 33.69 56.88 27.89L63.59 7.01C64.83 3.14 68.45 0.52 72.51 0.55L63.81 27.73C62.94 30.43 64.96 33.19 67.8 33.19H98.9C100.29 33.19 101.52 32.3 101.95 30.98L108.68 10.25C109.2 8.64 108 6.98 106.31 6.98L79.16 6.95C75.83 6.95 73.47 3.7 74.5 0.53V0.5H118.63Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M130.53 0.550003C126.51 0.550003 122.94 3.14 121.7 6.97L111.12 39.61H117.84L130.53 0.550003Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M155.55 0.5H132.48C131.45 3.67 133.81 6.92 137.14 6.92H155.65C157.36 6.92 158.56 8.59 158.03 10.21L153.21 24.95H159.97L164.09 12.28C165.98 6.47 161.65 0.51 155.54 0.51L155.55 0.5Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M150.92 24.94L155.84 10.9C156.21 9.85001 155.43 8.74001 154.31 8.74001H136.55C132.53 8.74001 128.97 11.33 127.73 15.15L119.78 39.67L126.52 39.6L129.8 29.51L135.63 39.6H143.04L134.54 24.88H131.3L133.6 17.8C134.11 16.22 135.58 15.16 137.24 15.16H145.65C146.6 15.16 147.26 16.1 146.95 16.99L144.17 24.89H136.75L145.15 39.61H152.57L144.21 24.94H150.93H150.92Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M179.75 0.550003L167.06 39.61H160.34L170.92 6.97C172.16 3.14 175.73 0.550003 179.75 0.550003Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M176.97 15.16L169.01 39.68L175.7 39.75L182.84 17.81C183.35 16.23 184.82 15.17 186.48 15.17H203.41C204.55 15.17 205.35 16.28 205 17.36L202.52 24.95H184.74C182.99 24.95 181.44 26.08 180.89 27.74L179.7 31.37H200.42L197.69 39.73H204.45L213.43 12.22C213.99 10.51 212.72 8.75999 210.92 8.75999H185.79C181.77 8.75999 178.21 11.35 176.97 15.17V15.16Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M206.39 39.68H213.1L222.15 11.64C223.93 6.14 219.82 0.5 214.04 0.5H181.83C180.8 3.67 183.16 6.92 186.49 6.92H211.21C214.08 6.92 216.11 9.72 215.23 12.44L206.39 39.68Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M62.66 0.550003L47.02 13.67C44.5 15.78 43.86 19.4 45.51 22.25L55.53 39.6H48.16L38.69 23.28C36.2 18.99 37.16 13.54 40.96 10.35L52.68 0.550003H62.66Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M46.04 39.68L39.06 27.59C35.89 22.1 28.54 20.81 23.69 24.88L15.54 31.72C13.56 33.38 10.64 31.41 11.44 28.95L20.66 0.550003H13.91L0.750025 41.07C-0.719975 45.6 4.65003 49.22 8.30003 46.16L25.05 32.1C28.28 29.39 33.18 30.26 35.28 33.92L38.58 39.67H46.03L46.04 39.68Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                  <path d="M22.59 0.550003H29.34L26.86 8.19C26.44 9.48 27.97 10.52 29.01 9.64L39.84 0.550003H49.82L25.31 21.11C21.58 24.24 16.09 20.53 17.59 15.9L22.59 0.550003Z" fill="currentColor" stroke="currentColor" stroke-miterlimit="10"/>
                </g>
                <defs>
                  <clipPath id="clip0_105_44">
                    <rect width="223.08" height="47.8" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </div>
            <span class="text-zinc-600 print:text-zinc-400 font-semibold text-xs ml-3 pl-3 border-l border-zinc-800 print:border-zinc-300">kora-fit.com</span>
          </div>
          <div class="text-right">
            <h1 class="text-xl font-bold uppercase text-white print:text-black tracking-wide">Sample Receipt Protocol</h1>
            <p class="text-xs text-zinc-500 print:text-zinc-600 font-semibold tracking-wide">Wareneingangsprotokoll / Musterprüfung</p>
          </div>
        </div>

        <!-- 01 PROTOCOL INFORMATION -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            01 Protocol Information
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 border-x border-b border-zinc-800 print:border-black text-xs">
            <div class="p-3 border-r border-b md:border-b-0 border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Protocol No.</span>
              <span class="font-bold text-white print:text-black">{{ protocol.protocolNo || '—' }}</span>
            </div>
            <div class="p-3 border-r border-b md:border-b-0 border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Date Received</span>
              <input type="date" [(ngModel)]="protocol.dateReceived" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
              <span class="hidden print:block font-bold text-black">{{ protocol.dateReceived ? (protocol.dateReceived | date:'dd/MM/yyyy') : '—' }}</span>
            </div>
            <div class="p-3 border-r border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Received By</span>
              <input type="text" [(ngModel)]="protocol.receivedBy" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
              <span class="hidden print:block font-bold text-black">{{ protocol.receivedBy || '—' }}</span>
            </div>
            <div class="p-3">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Department</span>
              <input type="text" [(ngModel)]="protocol.department" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" placeholder="e.g. Quality Assurance" />
              <span class="hidden print:block font-bold text-black">{{ protocol.department || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- 02 SUPPLIER INFORMATION -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            02 Supplier Information
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 border-x border-b border-zinc-800 print:border-black text-xs">
            <div class="p-3 border-r border-b border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Supplier Name</span>
              <span class="font-semibold text-white print:text-black">{{ protocol.supplierInfo.supplierName || '—' }}</span>
            </div>
            <div class="p-3 border-r border-b border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Country</span>
              <span class="font-semibold text-white print:text-black">{{ protocol.supplierInfo.country || '—' }}</span>
            </div>
            <div class="p-3 border-b border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Contact Person</span>
              <span class="font-semibold text-white print:text-black">{{ protocol.supplierInfo.contactPerson || '—' }}</span>
            </div>
            <div class="p-3 border-r border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Email</span>
              <span class="font-semibold text-white print:text-black">{{ protocol.supplierInfo.email || '—' }}</span>
            </div>
            <div class="p-3 border-r border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Order / PO No.</span>
              <span class="font-semibold text-white print:text-black">{{ protocol.supplierInfo.orderPoNo || '—' }}</span>
            </div>
            <div class="p-3">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Shipment Ref. / Tracking</span>
              <span class="font-semibold text-white print:text-black">{{ protocol.supplierInfo.shipmentRef || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- 03 SAMPLE DETAILS -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            03 Sample Details
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 border-x border-b border-zinc-800 print:border-black text-xs">
            <div class="p-3 border-r border-b border-zinc-800 print:border-black space-y-2">
              <span class="block text-zinc-500 font-medium uppercase tracking-wider text-[10px]">Product Type</span>
              <div class="flex flex-wrap gap-4 mt-1">
                @for (type of ['Football', 'Handball', 'T-Shirt', 'Other']; track type) {
                  <label class="flex items-center space-x-2 cursor-pointer select-none">
                    <input 
                      type="radio" [value]="type" [(ngModel)]="protocol.sampleDetails.productType" 
                      (change)="onProductTypeChange()"
                      name="productType" 
                      class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 focus:ring-0" 
                    />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productType === type ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">{{ type }}</span>
                  </label>
                }
              </div>
              @if (protocol.sampleDetails.productType === 'Other') {
                <input type="text" [(ngModel)]="protocol.sampleDetails.productTypeOther" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden mt-2" placeholder="Specify other type" />
                <span class="hidden print:block font-bold text-black pl-4">({{ protocol.sampleDetails.productTypeOther || 'Not specified' }})</span>
              }
            </div>
            
            <div class="p-3 border-b border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Qty Received</span>
              <input type="number" [(ngModel)]="protocol.sampleDetails.qtyReceived" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" min="1" />
              <span class="hidden print:block font-bold text-black">{{ protocol.sampleDetails.qtyReceived || '—' }}</span>
            </div>

            <div class="p-3 border-r border-b border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Model / SKU</span>
              <input type="text" [(ngModel)]="protocol.sampleDetails.modelSku" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
              <span class="hidden print:block font-bold text-black">{{ protocol.sampleDetails.modelSku || '—' }}</span>
            </div>

            <div class="p-3 border-b border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Size / Weight</span>
              <input type="text" [(ngModel)]="protocol.sampleDetails.sizeWeight" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" placeholder="e.g. Size 5 / 420g" />
              <span class="hidden print:block font-bold text-black">{{ protocol.sampleDetails.sizeWeight || '—' }}</span>
            </div>

            <div class="p-3 border-r border-b md:border-b-0 border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Material / Cover</span>
              <input type="text" [(ngModel)]="protocol.sampleDetails.materialCover" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
              <span class="hidden print:block font-bold text-black">{{ protocol.sampleDetails.materialCover || '—' }}</span>
            </div>

            <div class="p-3 border-b md:border-b-0 border-zinc-800 print:border-black">
              <span class="block text-zinc-500 font-medium mb-1 uppercase tracking-wider text-[10px]">Color / Design</span>
              <input type="text" [(ngModel)]="protocol.sampleDetails.colorDesign" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" placeholder="e.g. White/Yellow/Green" />
              <span class="hidden print:block font-bold text-black">{{ protocol.sampleDetails.colorDesign || '—' }}</span>
            </div>

            <div 
              class="p-3 border-t border-zinc-800 print:border-black space-y-2"
              [class.col-span-2]="protocol.sampleDetails.productType !== 'Handball'"
              [class.border-r]="protocol.sampleDetails.productType === 'Handball'"
            >
              <span class="block text-zinc-500 font-medium uppercase tracking-wider text-[10px]">Production Standard</span>
              <div class="flex flex-wrap gap-4 mt-1">
                @if (protocol.sampleDetails.productType === 'Football') {
                  <label class="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.en71" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.en71 ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">EN 71-1</span>
                  </label>
                  <label class="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.fifaQualityPro" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.fifaQualityPro ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">FIFA Quality Pro</span>
                  </label>
                  <label class="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.fifaBasic" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.fifaBasic ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">FIFA Basic</span>
                  </label>
                } @else if (protocol.sampleDetails.productType === 'Handball') {
                  <label class="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.en71" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.en71 ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">EN 71-1</span>
                  </label>
                  <label class="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.ihf" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.ihf ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">IHF</span>
                  </label>
                }

                <label class="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.none" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                  <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.none ? '☑' : '☐' }}</span>
                  <span class="text-white print:text-black">None</span>
                </label>
                <label class="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="protocol.sampleDetails.productionStandard.other" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                  <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.productionStandard.other ? '☑' : '☐' }}</span>
                  <span class="text-white print:text-black">Other</span>
                </label>
              </div>
              @if (protocol.sampleDetails.productionStandard.other) {
                <input type="text" [(ngModel)]="protocol.sampleDetails.productionStandard.otherText" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden mt-2" placeholder="Specify standard" />
                <span class="hidden print:block font-bold text-black pl-4">({{ protocol.sampleDetails.productionStandard.otherText || 'Not specified' }})</span>
              }
            </div>

            @if (protocol.sampleDetails.productType === 'Handball') {
              <div class="p-3 border-t border-zinc-800 print:border-black">
                <span class="block text-zinc-500 font-medium uppercase tracking-wider text-[10px]">Resin Compatible</span>
                <div class="flex items-center space-x-4 mt-2">
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" value="Yes" [(ngModel)]="protocol.sampleDetails.resinCompatible" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.resinCompatible === 'Yes' ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">Yes</span>
                  </label>
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" value="No" [(ngModel)]="protocol.sampleDetails.resinCompatible" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                    <span class="hidden print:inline text-sm">{{ protocol.sampleDetails.resinCompatible === 'No' ? '☑' : '☐' }}</span>
                    <span class="text-white print:text-black">No</span>
                  </label>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 04 PACKAGING & SHIPPING CONDITION -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            04 Packaging & Shipping Condition
          </div>
          <div class="overflow-x-auto">
            <table class="w-full border-x border-b border-zinc-800 print:border-black text-xs text-left">
              <thead>
                <tr class="bg-zinc-950/40 border-b border-zinc-800 print:border-black text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th class="p-3 font-semibold w-1/4">Inspection Item</th>
                  <th class="p-3 font-semibold w-1/2">Result</th>
                  <th class="p-3 font-semibold w-1/4">Notes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-900 print:divide-black">
                <!-- Carton Condition -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Outer carton condition</td>
                  <td class="p-3">
                    <div class="flex space-x-4">
                      @for (opt of ['Intact', 'Minor damage', 'Damaged']; track opt) {
                        <label class="flex items-center space-x-1.5 cursor-pointer">
                          <input type="radio" [value]="opt" [(ngModel)]="protocol.packagingCondition.outerCarton" name="outerCarton" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                          <span class="hidden print:inline text-xs">{{ protocol.packagingCondition.outerCarton === opt ? '☑' : '☐' }}</span>
                          <span class="text-zinc-300 print:text-black">{{ opt }}</span>
                        </label>
                      }
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.packagingCondition.outerCartonNotes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.packagingCondition.outerCartonNotes || '' }}</span>
                  </td>
                </tr>
                <!-- Packaging -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Individual ball packaging</td>
                  <td class="p-3">
                    <div class="flex space-x-4">
                      @for (opt of ['Polybag', 'Box', 'None', 'Custom']; track opt) {
                        <label class="flex items-center space-x-1.5 cursor-pointer">
                          <input type="radio" [value]="opt" [(ngModel)]="protocol.packagingCondition.individualPackaging" name="individualPackaging" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                          <span class="hidden print:inline text-xs">{{ protocol.packagingCondition.individualPackaging === opt ? '☑' : '☐' }}</span>
                          <span class="text-zinc-300 print:text-black">{{ opt }}</span>
                        </label>
                      }
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.packagingCondition.individualPackagingNotes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.packagingCondition.individualPackagingNotes || '' }}</span>
                  </td>
                </tr>
                <!-- Labelling -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Labelling / Hangtags</td>
                  <td class="p-3">
                    <div class="flex space-x-4">
                      @for (opt of ['Correct', 'Missing', 'Wrong']; track opt) {
                        <label class="flex items-center space-x-1.5 cursor-pointer">
                          <input type="radio" [value]="opt" [(ngModel)]="protocol.packagingCondition.labelling" name="labelling" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                          <span class="hidden print:inline text-xs">{{ protocol.packagingCondition.labelling === opt ? '☑' : '☐' }}</span>
                          <span class="text-zinc-300 print:text-black">{{ opt }}</span>
                        </label>
                      }
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.packagingCondition.labellingNotes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.packagingCondition.labellingNotes || '' }}</span>
                  </td>
                </tr>
                <!-- Branding -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Kora branding on product</td>
                  <td class="p-3">
                    <div class="flex flex-wrap gap-4">
                      @for (opt of ['Correct', 'Missing', 'Incorrect colour', 'Misaligned', 'Other']; track opt) {
                        <label class="flex items-center space-x-1.5 cursor-pointer">
                          <input type="radio" [value]="opt" [(ngModel)]="protocol.packagingCondition.koraBranding" name="koraBranding" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                          <span class="hidden print:inline text-xs">{{ protocol.packagingCondition.koraBranding === opt ? '☑' : '☐' }}</span>
                          <span class="text-zinc-300 print:text-black">{{ opt }}</span>
                        </label>
                      }
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.packagingCondition.koraBrandingNotes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.packagingCondition.koraBrandingNotes || '' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 05 PRODUCT QUALITY CHECK -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            05 Product Quality Check
          </div>
          <div class="overflow-x-auto">
            <table class="w-full border-x border-b border-zinc-800 print:border-black text-xs text-left">
              <thead>
                <tr class="bg-zinc-950/40 border-b border-zinc-800 print:border-black text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th class="p-3 font-semibold w-1/4">Quality Criterion</th>
                  <th class="p-3 font-semibold w-1/2">Rating</th>
                  <th class="p-3 font-semibold w-1/4">Notes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-900 print:divide-black">
                @for (crit of qualityCriteria; track crit.key) {
                  <tr>
                    <td class="p-3 font-medium text-white print:text-black">{{ crit.label }}</td>
                    <td class="p-3">
                      <div class="flex space-x-4">
                        @for (rate of ['Excellent', 'Good', 'Acceptable', 'Poor']; track rate) {
                          <label class="flex items-center space-x-1.5 cursor-pointer">
                            <input type="radio" [value]="rate" [(ngModel)]="getQC(crit.key).rating" [name]="crit.key" class="print:hidden h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" />
                            <span class="hidden print:inline text-xs">{{ getQC(crit.key).rating === rate ? '☑' : '☐' }}</span>
                            <span class="text-zinc-300 print:text-black">{{ rate }}</span>
                          </label>
                        }
                      </div>
                    </td>
                    <td class="p-2">
                      <input type="text" [(ngModel)]="getQC(crit.key).notes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                      <span class="hidden print:block text-black text-xs">{{ getQC(crit.key).notes || '' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- PAGE BREAK FOR PRINT -->
        <div class="page-break"></div>

        <!-- 06 SPECIFICATION COMPLIANCE -->
        <div class="mb-6 mt-0 print:mt-4">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            06 Specification Compliance
          </div>
          <div class="overflow-x-auto">
            <table class="w-full border-x border-b border-zinc-800 print:border-black text-xs text-left">
              <thead>
                <tr class="bg-zinc-950/40 border-b border-zinc-800 print:border-black text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th class="p-3 font-semibold w-1/4">Specification</th>
                  <th class="p-3 font-semibold w-1/2">Measured & Target values</th>
                  <th class="p-3 font-semibold w-1/4">Notes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-900 print:divide-black">
                <!-- Circumference -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Circumference</td>
                  <td class="p-3">
                    <div class="flex items-center">
                      <!-- Measured Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Measured:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.circumference.measured" class="w-16 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="cm" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[30px] text-center px-1">{{ protocol.specCompliance.circumference.measured || '___' }}</span>
                        <span class="text-zinc-500 ml-1 shrink-0 w-6">cm</span>
                      </div>
                      <!-- Spec Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Spec:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.circumference.spec" class="w-16 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="cm" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[30px] text-center px-1">{{ protocol.specCompliance.circumference.spec || '___' }}</span>
                        <span class="text-zinc-500 ml-1 shrink-0 w-6">cm</span>
                      </div>
                      <!-- Status/Verdict Col -->
                      <div class="flex items-center space-x-2 border-l border-zinc-800 print:border-black pl-3 ml-1">
                        @for (val of ['OK', 'Fail']; track val) {
                          <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" [value]="val" [(ngModel)]="protocol.specCompliance.circumference.status" name="circumferenceStatus" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                            <span class="hidden print:inline text-xs">{{ protocol.specCompliance.circumference.status === val ? '☑' : '☐' }}</span>
                            <span class="text-zinc-300 print:text-black font-semibold">{{ val }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.specCompliance.circumference.notes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.specCompliance.circumference.notes || '' }}</span>
                  </td>
                </tr>
                <!-- Weight -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Weight</td>
                  <td class="p-3">
                    <div class="flex items-center">
                      <!-- Measured Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Measured:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.weight.measured" class="w-16 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="g" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[30px] text-center px-1">{{ protocol.specCompliance.weight.measured || '___' }}</span>
                        <span class="text-zinc-500 ml-1 shrink-0 w-6">g</span>
                      </div>
                      <!-- Spec Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Spec:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.weight.spec" class="w-16 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="g" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[30px] text-center px-1">{{ protocol.specCompliance.weight.spec || '___' }}</span>
                        <span class="text-zinc-500 ml-1 shrink-0 w-6">g</span>
                      </div>
                      <!-- Status/Verdict Col -->
                      <div class="flex items-center space-x-2 border-l border-zinc-800 print:border-black pl-3 ml-1">
                        @for (val of ['OK', 'Fail']; track val) {
                          <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" [value]="val" [(ngModel)]="protocol.specCompliance.weight.status" name="weightStatus" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                            <span class="hidden print:inline text-xs">{{ protocol.specCompliance.weight.status === val ? '☑' : '☐' }}</span>
                            <span class="text-zinc-300 print:text-black font-semibold">{{ val }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.specCompliance.weight.notes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.specCompliance.weight.notes || '' }}</span>
                  </td>
                </tr>
                <!-- Pressure -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Pressure (bar)</td>
                  <td class="p-3">
                    <div class="flex items-center">
                      <!-- Measured Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Measured:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.pressure.measured" class="w-16 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="bar" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[30px] text-center px-1">{{ protocol.specCompliance.pressure.measured || '___' }}</span>
                        <span class="text-zinc-500 ml-1 shrink-0 w-6">bar</span>
                      </div>
                      <!-- Spec Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Spec:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.pressure.spec" class="w-16 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="bar" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[30px] text-center px-1">{{ protocol.specCompliance.pressure.spec || '___' }}</span>
                        <span class="text-zinc-500 ml-1 shrink-0 w-6">bar</span>
                      </div>
                      <!-- Status/Verdict Col -->
                      <div class="flex items-center space-x-2 border-l border-zinc-800 print:border-black pl-3 ml-1">
                        @for (val of ['OK', 'Fail']; track val) {
                          <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" [value]="val" [(ngModel)]="protocol.specCompliance.pressure.status" name="pressureStatus" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                            <span class="hidden print:inline text-xs">{{ protocol.specCompliance.pressure.status === val ? '☑' : '☐' }}</span>
                            <span class="text-zinc-300 print:text-black font-semibold">{{ val }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.specCompliance.pressure.notes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.specCompliance.pressure.notes || '' }}</span>
                  </td>
                </tr>
                <!-- Pantone -->
                <tr>
                  <td class="p-3 font-medium text-white print:text-black">Pantone / color code</td>
                  <td class="p-3">
                    <div class="flex items-center">
                      <!-- Expected Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Expected:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.pantoneColor.expected" class="w-20 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Expected" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[40px] text-center px-1">{{ protocol.specCompliance.pantoneColor.expected || '___' }}</span>
                      </div>
                      <!-- Received Col -->
                      <div class="flex items-center space-x-1 w-[170px] shrink-0">
                        <span class="text-zinc-500 w-[60px] shrink-0">Received:</span>
                        <input type="text" [(ngModel)]="protocol.specCompliance.pantoneColor.received" class="w-20 bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Received" />
                        <span class="hidden print:inline font-bold text-black border-b border-black min-w-[40px] text-center px-1">{{ protocol.specCompliance.pantoneColor.received || '___' }}</span>
                      </div>
                      <!-- Status/Verdict Col -->
                      <div class="flex items-center space-x-2 border-l border-zinc-800 print:border-black pl-3 ml-1">
                        @for (val of ['Match', 'Deviation']; track val) {
                          <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" [value]="val" [(ngModel)]="protocol.specCompliance.pantoneColor.status" name="pantoneStatus" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                            <span class="hidden print:inline text-xs">{{ protocol.specCompliance.pantoneColor.status === val ? '☑' : '☐' }}</span>
                            <span class="text-zinc-300 print:text-black font-semibold">{{ val }}</span>
                          </label>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="p-2">
                    <input type="text" [(ngModel)]="protocol.specCompliance.pantoneColor.notes" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 print:hidden" placeholder="Notes..." />
                    <span class="hidden print:block text-black">{{ protocol.specCompliance.pantoneColor.notes || '' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 07 DEFECT LOG -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            07 Defect Log
          </div>
          <div class="overflow-x-auto">
            <table class="w-full border-x border-b border-zinc-800 print:border-black text-xs text-left">
              <thead>
                <tr class="bg-zinc-950/40 border-b border-zinc-800 print:border-black text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th class="p-3 font-semibold w-12 text-center">#</th>
                  <th class="p-3 font-semibold w-1/4">Category</th>
                  <th class="p-3 font-semibold w-5/12">Description</th>
                  <th class="p-3 font-semibold w-1/4">Severity</th>
                  <th class="p-3 font-semibold w-24 text-center">Photo Ref.</th>
                  <th class="p-3 font-semibold w-16 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-900 print:divide-black">
                @for (item of protocol.defectLog; track i; let i = $index) {
                  <tr>
                    <td class="p-3 text-center font-bold text-zinc-500 print:text-black">{{ i + 1 }}</td>
                    <td class="p-2">
                      <input type="text" [(ngModel)]="item.category" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" placeholder="e.g. Printing" />
                      <span class="hidden print:block text-black">{{ item.category || '' }}</span>
                    </td>
                    <td class="p-2">
                      <input type="text" [(ngModel)]="item.description" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" placeholder="e.g. Ink bleed on branding logo" />
                      <span class="hidden print:block text-black">{{ item.description || '' }}</span>
                    </td>
                    <td class="p-2">
                      <div class="flex space-x-2">
                        @for (sev of ['Minor', 'Major', 'Critical']; track sev) {
                          <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" [value]="sev" [(ngModel)]="item.severity" [name]="'severity_' + i" class="print:hidden h-3.5 w-3.5 border-zinc-700 bg-zinc-900" />
                            <span class="hidden print:inline text-xs">{{ item.severity === sev ? '☑' : '☐' }}</span>
                            <span class="text-zinc-300 print:text-black text-[11px]">{{ sev }}</span>
                          </label>
                        }
                      </div>
                    </td>
                    <td class="p-2">
                      <input type="text" [(ngModel)]="item.photoRef" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden text-center" placeholder="e.g. IMG_01" />
                      <span class="hidden print:block text-black font-mono text-center">{{ item.photoRef || '' }}</span>
                    </td>
                    <td class="p-2 text-center print:hidden">
                      <button 
                        type="button" 
                        (click)="removeDefectRow(i)" 
                        class="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                        title="Remove Row"
                      >
                        <svg class="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="mt-3 flex justify-end print:hidden">
            <button 
              type="button" 
              (click)="addDefectRow()" 
              class="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded border border-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Defect Row
            </button>
          </div>
        </div>

        <!-- 08 OVERALL VERDICT -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            08 Overall Verdict
          </div>
          <div class="border-x border-b border-zinc-800 print:border-black p-5 text-sm">
            <div class="flex flex-col md:flex-row md:items-center justify-around gap-4">
              
              <!-- Approved Option -->
              <label class="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-emerald-950/60 bg-emerald-950/20 print:border-emerald-500 print:bg-emerald-50 w-full md:w-auto">
                <input type="radio" value="Approved" [(ngModel)]="protocol.overallVerdict" name="verdict" class="print:hidden h-4 w-4 border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-0" />
                <span class="hidden print:inline text-lg text-emerald-600 font-bold">{{ protocol.overallVerdict === 'Approved' ? '☑' : '☐' }}</span>
                <div class="text-emerald-400 print:text-emerald-700">
                  <span class="font-bold block text-xs tracking-wider uppercase">APPROVED</span>
                  <span class="text-xs">Proceed to production / ordering</span>
                </div>
              </label>

              <!-- Conditional Approved Option -->
              <label class="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-amber-950/60 bg-amber-950/20 print:border-amber-500 print:bg-amber-50 w-full md:w-auto">
                <input type="radio" value="Conditional" [(ngModel)]="protocol.overallVerdict" name="verdict" class="print:hidden h-4 w-4 border-zinc-700 bg-zinc-900 text-amber-600 focus:ring-0" />
                <span class="hidden print:inline text-lg text-amber-600 font-bold">{{ protocol.overallVerdict === 'Conditional' ? '☑' : '☐' }}</span>
                <div class="text-amber-400 print:text-amber-700">
                  <span class="font-bold block text-xs tracking-wider uppercase">CONDITIONAL APPROVAL</span>
                  <span class="text-xs">Minor corrections required</span>
                </div>
              </label>

              <!-- Rejected Option -->
              <label class="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-red-950/60 bg-red-950/20 print:border-red-500 print:bg-red-50 w-full md:w-auto">
                <input type="radio" value="Rejected" [(ngModel)]="protocol.overallVerdict" name="verdict" class="print:hidden h-4 w-4 border-zinc-700 bg-zinc-900 text-red-600 focus:ring-0" />
                <span class="hidden print:inline text-lg text-red-600 font-bold">{{ protocol.overallVerdict === 'Rejected' ? '☑' : '☐' }}</span>
                <div class="text-red-400 print:text-red-700">
                  <span class="font-bold block text-xs tracking-wider uppercase">REJECTED</span>
                  <span class="text-xs">Sample does not meet standards</span>
                </div>
              </label>

            </div>
          </div>
        </div>

        <!-- 09 REMARKS & NEXT STEPS -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            09 Remarks & Next Steps
          </div>
          <div class="border-x border-b border-zinc-800 print:border-black p-3 text-xs">
            <textarea
              [(ngModel)]="protocol.remarks"
              rows="4"
              class="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-3 print:hidden resize-none"
              placeholder="Record any general remarks, action items, or recommendations for supplier improvements..."
            ></textarea>
            <div class="hidden print:block text-black text-xs min-h-[80px] p-2 leading-relaxed whitespace-pre-wrap">
              {{ protocol.remarks || 'No general remarks recorded.' }}
            </div>
          </div>
        </div>

        <!-- 10 SIGN-OFF -->
        <div class="mb-6">
          <div class="bg-zinc-900 print:bg-zinc-100 px-4 py-2 border border-zinc-800 print:border-black font-semibold text-xs uppercase tracking-wider text-zinc-300 print:text-black">
            10 Sign-Off
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 border-x border-b border-zinc-800 print:border-black text-xs">
            <!-- Checked by -->
            <div class="p-4 border-b md:border-b-0 md:border-r border-zinc-800 print:border-black space-y-4">
              <span class="block text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Checked By</span>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <span class="block text-zinc-500 text-[9px] uppercase">Name</span>
                  <input type="text" [(ngModel)]="protocol.signOff.checkedByName" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
                  <span class="hidden print:block font-bold text-black border-b border-black pb-0.5">{{ protocol.signOff.checkedByName || '—' }}</span>
                </div>
                <div>
                  <span class="block text-zinc-500 text-[9px] uppercase">Date</span>
                  <input type="date" [(ngModel)]="protocol.signOff.checkedByDate" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
                  <span class="hidden print:block font-bold text-black border-b border-black pb-0.5">{{ protocol.signOff.checkedByDate ? (protocol.signOff.checkedByDate | date:'dd/MM/yyyy') : '—' }}</span>
                </div>
              </div>
              <div class="pt-4 border-t border-zinc-900 print:border-zinc-300">
                <span class="block text-zinc-500 text-[9px] uppercase mb-6">Signature / Initials</span>
                <div class="h-8 border-b border-dashed border-zinc-800 print:border-black"></div>
              </div>
            </div>

            <!-- Approved by -->
            <div class="p-4 space-y-4">
              <span class="block text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Approved By</span>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <span class="block text-zinc-500 text-[9px] uppercase">Name</span>
                  <input type="text" [(ngModel)]="protocol.signOff.approvedByName" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
                  <span class="hidden print:block font-bold text-black border-b border-black pb-0.5">{{ protocol.signOff.approvedByName || '—' }}</span>
                </div>
                <div>
                  <span class="block text-zinc-500 text-[9px] uppercase">Date</span>
                  <input type="date" [(ngModel)]="protocol.signOff.approvedByDate" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 print:hidden" />
                  <span class="hidden print:block font-bold text-black border-b border-black pb-0.5">{{ protocol.signOff.approvedByDate ? (protocol.signOff.approvedByDate | date:'dd/MM/yyyy') : '—' }}</span>
                </div>
              </div>
              <div class="pt-4 border-t border-zinc-900 print:border-zinc-300">
                <span class="block text-zinc-500 text-[9px] uppercase mb-6">Signature / Initials</span>
                <div class="h-8 border-b border-dashed border-zinc-800 print:border-black"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer for quality records (Print Only) -->
        <div class="hidden print:flex items-center justify-between text-[9px] text-zinc-500 border-t border-zinc-300 pt-3 mt-4">
          <span>KORA — kora-fit.com</span>
          <span class="uppercase tracking-wider font-semibold">Sample Receipt Protocol</span>
          <span>Keep on file for quality records</span>
        </div>

      </div>

      <!-- Bottom Actions for Online View -->
      <div class="flex justify-end gap-3 mt-6 print:hidden">
        <a [routerLink]="['/samples', sampleId()]" class="px-6 py-2.5 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 text-sm font-semibold rounded-lg border border-zinc-700 transition-colors">
          Cancel
        </a>
        <button
          (click)="saveProtocol()"
          [disabled]="saving()"
          class="px-6 py-2.5 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {{ saving() ? 'Saving...' : 'Save Protocol' }}
        </button>
      </div>

    </div>
  `,
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
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  sampleId = signal<number>(0);
  sample = signal<Sample | null>(null);
  saving = signal<boolean>(false);
  supplierContacts = signal<SupplierContact[]>([]);

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
      { category: '', description: '', severity: '', photoRef: '' }
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
      this.protocol.sampleDetails.productionStandard.fifaQualityPro = false;
      this.protocol.sampleDetails.productionStandard.fifaBasic = false;
    } else {
      // T-Shirt or Other
      this.protocol.sampleDetails.resinCompatible = '';
      this.protocol.sampleDetails.productionStandard.en71 = false;
      this.protocol.sampleDetails.productionStandard.fifa = false;
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
    this.protocol.defectLog.push({ category: '', description: '', severity: '', photoRef: '' });
  }

  removeDefectRow(index: number): void {
    if (this.protocol.defectLog && this.protocol.defectLog.length > 0) {
      this.protocol.defectLog.splice(index, 1);
    }
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
              { category: '', description: '', severity: '', photoRef: '' }
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
        item.photoRef?.trim()
      );
    }

    this.api.updateSample(this.sampleId(), {
      receiptProtocol: cleanedProtocol
    } as any).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.sample.set(updated);
        alert('Sample receipt protocol saved successfully!');
        this.router.navigate(['/samples', this.sampleId()]);
      },
      error: (err) => {
        this.saving.set(false);
        console.error('Error saving receipt protocol:', err);
        alert('Could not save the protocol. Please try again.');
      }
    });
  }

  printProtocol(): void {
    window.print();
  }
}
