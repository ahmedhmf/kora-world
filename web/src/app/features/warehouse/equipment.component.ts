import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WarehouseSite, WarehouseLocation } from '../../core/models/warehouse.model';

@Component({
 selector:'app-equipment',standalone:true,imports:[CommonModule,FormsModule],
 template:`
 <div class="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
 <header><h1 class="text-3xl font-bold">Equipment inventory</h1><p class="text-sm text-zinc-400">Reusable event equipment and operational supplies, separate from saleable products.</p></header>
 @if(error()){<p role="alert" class="text-red-300">{{error()}}</p>}
 @if(success()){<p role="status" class="text-emerald-300">{{success()}}</p>}
 <section class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
 <h2 class="font-semibold">Equipment catalogue</h2>
 <fieldset [disabled]="busy()" class="space-y-3">
 <div class="grid md:grid-cols-4 gap-3">
 <label class="text-sm text-zinc-400">Code<input [(ngModel)]="form.code" maxlength="40" placeholder="GOAL-01" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 <label class="text-sm text-zinc-400">Name<input [(ngModel)]="form.name" maxlength="160" placeholder="Portable goal" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 <label class="text-sm text-zinc-400">Category<input [(ngModel)]="form.category" maxlength="100" placeholder="Event equipment" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 <label class="text-sm text-zinc-400">Description<input [(ngModel)]="form.description" maxlength="2000" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 </div><button (click)="create()" type="button" class="bg-white text-zinc-900 rounded px-4 py-2 font-semibold text-sm">Add equipment</button>
 </fieldset>
 <div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-zinc-400"><tr><th class="p-2">Code</th><th>Name</th><th>Category</th><th>Description</th></tr></thead><tbody>
 @for(e of catalogue();track e.id){<tr class="border-t border-zinc-800"><td class="p-2">{{e.code}}</td><td>{{e.name}}</td><td>{{e.category||'—'}}</td><td>{{e.description||'—'}}</td></tr>}@empty{<tr><td colspan="4" class="p-4 text-zinc-500">No equipment yet.</td></tr>}
 </tbody></table></div>
 </section>
 <section class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
 <div class="flex flex-wrap justify-between gap-3"><label class="text-sm text-zinc-400">Warehouse<select [ngModel]="warehouseId" (ngModelChange)="selectWarehouse($event)" [disabled]="busy()" class="block bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select warehouse</option>@for(w of sites();track w.id){<option [ngValue]="w.id">{{w.name}}</option>}</select></label><button (click)="refresh()" [disabled]="busy()" type="button" class="text-sm text-zinc-400">Refresh</button></div>
 @if(warehouseId){
 <h2 class="font-semibold">Record equipment movement</h2>
 <fieldset [disabled]="busy()" class="space-y-3">
 <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
 <label class="text-sm text-zinc-400">Operation<select [(ngModel)]="movement.action" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option value="receipt">Receive</option><option value="issue">Issue</option><option value="return">Return</option><option value="adjustment">Adjust</option><option value="transfer">Transfer</option></select></label>
 <label class="text-sm text-zinc-400">Equipment<select [(ngModel)]="movement.equipmentId" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select equipment</option>@for(e of catalogue();track e.id){<option [ngValue]="e.id">{{e.code}} — {{e.name}}</option>}</select></label>
 <label class="text-sm text-zinc-400">Location<select [(ngModel)]="movement.locationId" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select location</option>@for(l of locations();track l.id){<option [ngValue]="l.id">{{l.code}} — {{l.name}}</option>}</select></label>
 @if(movement.action==='transfer'){<label class="text-sm text-zinc-400">Destination<select [(ngModel)]="movement.toLocationId" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"><option [ngValue]="0">Select destination</option>@for(l of locations();track l.id){@if(l.id!==movement.locationId){<option [ngValue]="l.id">{{l.code}}</option>}}</select></label>}
 <label class="text-sm text-zinc-400">Quantity<input type="number" step="1" [(ngModel)]="movement.quantity" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 <label class="text-sm text-zinc-400">Reference<input [(ngModel)]="movement.reference" maxlength="160" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 <label class="text-sm text-zinc-400">Notes / adjustment reason<input [(ngModel)]="movement.notes" maxlength="2000" class="block w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white"></label>
 </div><button type="button" (click)="record()" class="bg-white text-zinc-900 rounded px-4 py-2 font-semibold text-sm">Record movement</button>
 </fieldset>
 <h2 class="font-semibold">On-hand equipment</h2>
 <div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-zinc-400"><tr><th class="p-2">Code</th><th>Equipment</th><th>Location</th><th>Quantity</th></tr></thead><tbody>@for(s of stock();track s.equipmentId+':'+s.locationId){<tr class="border-t border-zinc-800"><td class="p-2">{{s.code}}</td><td>{{s.name}}</td><td>{{s.locationCode}}</td><td>{{s.quantity}}</td></tr>}@empty{<tr><td colspan="4" class="p-4 text-zinc-500">No equipment stock.</td></tr>}</tbody></table></div>
 <h2 class="font-semibold">Movement history</h2>
 <div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-zinc-400"><tr><th class="p-2">Date</th><th>Equipment</th><th>Location</th><th>Operation</th><th>Change</th><th>Reference / notes</th><th>User</th></tr></thead><tbody>@for(m of history();track m.id){<tr class="border-t border-zinc-800"><td class="p-2">{{m.createdAt|date:'short'}}</td><td>{{m.code}} — {{m.name}}</td><td>{{m.locationCode}}</td><td>{{m.type}}</td><td>{{m.quantityChange}}</td><td>{{m.reference||'—'}} {{m.notes}}</td><td>{{m.performedById}}</td></tr>}@empty{<tr><td colspan="7" class="p-4 text-zinc-500">No movements.</td></tr>}</tbody></table></div>
 }
 </section></div>`
})
export class EquipmentComponent implements OnInit {
 private api=inject(ApiService);
 catalogue=signal<{id:number;code:string;name:string;category:string|null;description:string|null}[]>([]);
 sites=signal<WarehouseSite[]>([]); locations=signal<WarehouseLocation[]>([]);
 stock=signal<{equipmentId:number;code:string;name:string;locationId:number;locationCode:string;quantity:number}[]>([]);
 history=signal<{id:string;code:string;name:string;locationCode:string;quantityChange:number;type:string;reference:string|null;notes:string|null;createdAt:string;performedById:number|null}[]>([]);
 busy=signal(false);error=signal('');success=signal('');warehouseId=0;
 form={code:'',name:'',category:'',description:''};
 movement={equipmentId:0,locationId:0,toLocationId:0,quantity:1,action:'receipt',reference:'',notes:''};
 ngOnInit(){void this.refresh();}
 private message(e:any){return Array.isArray(e?.error?.message)?e.error.message.join('; '):e?.error?.message||'Request failed';}
 private async loadWarehouse(){this.stock.set([]);this.history.set([]);this.locations.set([]);if(!this.warehouseId)return;
 const r=await firstValueFrom(forkJoin({locations:this.api.getWarehouseLocations(this.warehouseId),stock:this.api.getEquipmentStock(this.warehouseId),history:this.api.getEquipmentMovements(this.warehouseId)}));this.locations.set(r.locations.filter(l=>l.is_active));this.stock.set(r.stock);this.history.set(r.history);}
 async refresh(){if(this.busy())return;this.busy.set(true);this.error.set('');try{const r=await firstValueFrom(forkJoin({catalogue:this.api.getEquipment(),sites:this.api.getWarehouses()}));this.catalogue.set(r.catalogue);this.sites.set(r.sites.filter(w=>w.is_active));await this.loadWarehouse();}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
 async selectWarehouse(id:number){if(this.busy())return;this.warehouseId=id;this.movement.locationId=0;this.movement.toLocationId=0;this.busy.set(true);this.error.set('');try{await this.loadWarehouse();}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
 async create(){if(this.busy())return;this.busy.set(true);this.error.set('');this.success.set('');try{await firstValueFrom(this.api.createEquipment({...this.form}));this.form={code:'',name:'',category:'',description:''};this.success.set('Equipment created');this.catalogue.set(await firstValueFrom(this.api.getEquipment()));}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
 async record(){if(this.busy())return;this.busy.set(true);this.error.set('');this.success.set('');try{await firstValueFrom(this.api.recordEquipment(this.warehouseId,{...this.movement}));this.movement.quantity=1;this.movement.notes='';this.movement.reference='';this.success.set('Movement recorded');try{await this.loadWarehouse();}catch{this.error.set('Movement saved but refresh failed. Reload before recording another.');}}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
}
