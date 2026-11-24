import { Component, Input, OnInit, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WarehouseSite, WarehouseLocation } from '../../core/models/warehouse.model';

@Component({
 selector:'app-customer-returns',standalone:true,imports:[CommonModule,FormsModule],
 template:`
 <section class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
 <h2 class="font-semibold">Customer returns to warehouse</h2>
 <p class="text-sm text-zinc-400">Record products physically received back from this customer. Customer inventory decreases and warehouse stock increases together.</p>
 @if(error()){<p role="alert" class="text-red-300">{{error()}}</p>}
 @if(success()){<p role="status" class="text-emerald-300">{{success()}}</p>}
 <fieldset [disabled]="busy()" class="space-y-3">
 <div class="grid sm:grid-cols-2 gap-3">
 <label class="text-sm text-zinc-400">Product<select [(ngModel)]="productId" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select product</option>@for(p of inventory();track p.productId){@if(p.quantity>0){<option [ngValue]="p.productId">{{p.articleNumber}} — {{p.productName}} ({{p.quantity}} available)</option>}}</select></label>
 <label class="text-sm text-zinc-400">Quantity<input type="number" min="1" step="1" [(ngModel)]="quantity" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 <label class="text-sm text-zinc-400">Destination warehouse<select [ngModel]="warehouseId" (ngModelChange)="selectWarehouse($event)" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select warehouse</option>@for(w of sites();track w.id){<option [ngValue]="w.id">{{w.name}}</option>}</select></label>
 <label class="text-sm text-zinc-400">Destination location<select [(ngModel)]="locationId" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select location</option>@for(l of locations();track l.id){<option [ngValue]="l.id">{{l.code}} — {{l.name}}</option>}</select></label>
 </div>
 <label class="text-sm text-zinc-400">Reason / return reference (required)<textarea [(ngModel)]="notes" maxlength="2000" rows="2" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></textarea></label>
 <p class="text-xs text-zinc-400">Use a dedicated quarantine location for damaged goods. This operation does not create a refund or credit note.</p>
 <button type="button" (click)="record()" class="bg-white text-zinc-900 rounded px-4 py-2 font-semibold text-sm">Confirm physical return</button>
 <button type="button" (click)="refresh()" class="ml-3 text-sm text-zinc-400">Refresh</button>
 </fieldset>
 <h3 class="font-semibold text-sm">Return history</h3>
 @for(r of history();track r.id){<div class="border border-zinc-800 rounded p-3 text-sm"><strong>CR-{{r.id.toString().padStart(6,'0')}}</strong> · {{r.productName}} · {{r.quantity}} units<p class="text-zinc-400">{{r.warehouseName}} / {{r.locationCode}} · {{r.createdAt | date:'short'}}</p><p>{{r.notes}}</p></div>}@empty{<p class="text-sm text-zinc-500">No warehouse returns yet.</p>}
 </section>`
})
export class CustomerReturnsComponent implements OnInit {
 @Input({required:true}) accountId!:number;
 readonly returned = output<void>();
 private api=inject(ApiService);
 inventory=signal<{productId:number;articleNumber:string;productName:string;quantity:number}[]>([]);
 history=signal<{id:number;productName:string;quantity:number;warehouseName:string;locationCode:string;notes:string;createdAt:string}[]>([]);
 sites=signal<WarehouseSite[]>([]); locations=signal<WarehouseLocation[]>([]);
 busy=signal(false);error=signal('');success=signal('');
 productId=0;quantity=1;warehouseId=0;locationId=0;notes='';
 private pending:{key:string;fingerprint:string}|null=null;
 ngOnInit(){void this.refresh();}
 private message(e:any){return Array.isArray(e?.error?.message)?e.error.message.join('; '):e?.error?.message||'Request failed';}
 private async load(){const r=await firstValueFrom(forkJoin({inventory:this.api.getAccountInventory(this.accountId),history:this.api.getCustomerReturns(this.accountId),sites:this.api.getWarehouses()}));this.inventory.set(r.inventory);this.history.set(r.history);this.sites.set(r.sites.filter(w=>w.is_active));}
 async refresh(){if(this.busy())return;this.busy.set(true);this.error.set('');try{await this.load();}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
 async selectWarehouse(id:number){if(this.busy())return;this.warehouseId=id;this.locationId=0;this.locations.set([]);if(!id)return;this.busy.set(true);try{this.locations.set((await firstValueFrom(this.api.getWarehouseLocations(id))).filter(l=>l.is_active));}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
 async record(){if(this.busy())return;this.error.set('');this.success.set('');
 const dto={productId:this.productId,quantity:this.quantity,warehouseId:this.warehouseId,locationId:this.locationId,notes:this.notes.trim()};
 const fingerprint=JSON.stringify(dto);
 if(this.pending&&this.pending.fingerprint!==fingerprint){this.error.set('Previous request outcome uncertain. Retry original details or reload and inspect history.');return;}
 if(!dto.productId||!dto.warehouseId||!dto.locationId||!Number.isInteger(dto.quantity)||dto.quantity<1||dto.quantity>100000||!dto.notes||(!this.pending&&dto.quantity>(this.inventory().find(p=>p.productId===dto.productId)?.quantity??0))){this.error.set('Select product, valid quantity, destination and reason.');return;}
 if(!window.confirm('Confirm products have physically arrived at the warehouse?'))return;
 this.pending??={key:crypto.randomUUID(),fingerprint};this.busy.set(true);
 try{const r=await firstValueFrom(this.api.returnCustomerStock(this.accountId,{...dto,requestKey:this.pending.key}));this.pending=null;this.productId=0;this.quantity=1;this.notes='';this.success.set('Return CR-'+String(r.id).padStart(6,'0')+' recorded. Both balances updated.');this.returned.emit();try{await this.load();}catch{this.error.set('Saved, but refresh failed. Reload before recording another return.');}}
 catch(e:any){if(e?.status>=400&&e.status<500)this.pending=null;this.error.set(this.message(e));}finally{this.busy.set(false);}
 }
}
