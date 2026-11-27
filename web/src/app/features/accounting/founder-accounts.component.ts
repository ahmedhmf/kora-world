import { Component, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
interface Account{id:number;code:string;name:string;type:string}
interface Founder{account_id:number;founder_name:string;code:string;balance_cents:string}
interface Transaction{id:number;account_id:number;kind:string;evidence_reference:string;journal_id:number;date:string;description:string;posting_status:string;amount_cents:string}
interface Evidence{id:number;transaction_id:number;filename:string;size:number}
interface Data{founders:Founder[];transactions:Transaction[];accounts:Account[];attachments:Evidence[]}
@Component({standalone:true,imports:[FormsModule,RouterLink],template:`
<div class="mx-auto max-w-6xl space-y-6 p-6">
<header><h1 class="text-3xl font-bold">Founder Accounts</h1><p class="text-zinc-500">EGP local pilot · Record repayable founder funding and reimbursements through journal approval.</p><a routerLink="/accounting/journal" class="underline">Journal Entries</a> · <a routerLink="/accounting/chart-of-accounts" class="underline">Chart of Accounts</a> · <a routerLink="/academy" [queryParams]="{category:'finance'}" class="underline">Finance training</a></header>
@if(error()){<p role="alert" class="text-red-500">{{error()}}</p>}@if(notice()){<p role="status" class="text-green-500">{{notice()}}</p>}
<section class="space-y-3 rounded-xl border p-4"><h2 class="text-xl font-semibold">Record transaction</h2><fieldset [disabled]="busy()" class="space-y-3">
<label class="block">Transaction type <select [(ngModel)]="kind" (ngModelChange)="otherId=0" class="rounded border bg-transparent p-2"><option value="expense">Founder paid expense</option><option value="loan">Founder lent money</option><option value="repayment">Company reimbursed founder</option></select></label>
<label class="block">Founder <select [(ngModel)]="founderId" class="rounded border bg-transparent p-2"><option [ngValue]="0">Select</option>@for(f of data().founders;track f.account_id){<option [ngValue]="f.account_id">{{f.founder_name}}</option>}</select></label>
<label class="block">{{kind==='expense'?'Expense category':'Company cash / bank account'}} <select [(ngModel)]="otherId" class="rounded border bg-transparent p-2"><option [ngValue]="0">Select</option>@for(a of eligible();track a.id){<option [ngValue]="a.id">{{a.code}} · {{a.name}}</option>}</select></label>
<label class="block">Amount (EGP) <input type="number" min="0.01" step="0.01" [(ngModel)]="amount" class="rounded border bg-transparent p-2"></label>
<label class="block">Transaction date <input type="date" [(ngModel)]="date" class="rounded border bg-transparent p-2"></label>
<label class="block">Business purpose <input [(ngModel)]="description" maxlength="500" class="w-full rounded border bg-transparent p-2"></label>
<label class="block">Receipt / bank evidence reference <input [(ngModel)]="evidence" maxlength="300" class="w-full rounded border bg-transparent p-2"></label>
<div class="rounded-lg border border-dashed border-zinc-500 p-4 space-y-2"><label class="block font-semibold" for="founder-proof">Attach receipt or payment proof (optional)</label><input id="founder-proof" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" (change)="selectFiles($event)" class="block max-w-full file:mr-3 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:text-black"><p class="text-sm text-zinc-400">PDF, JPG or PNG · 10 MB per file · up to 10 files</p>@for(file of selectedFiles();track $index){<div class="flex items-center gap-3 text-sm"><span>{{file.name}}</span><button type="button" class="underline" (click)="removeFile($index)">Remove</button></div>}</div>
<label class="block"><input type="checkbox" [(ngModel)]="confirmed"> Evidence retained and verified; transaction is not already recorded. Repayment has actually occurred and is approved.</label>
</fieldset><p class="text-sm text-zinc-500">Creates a journal draft only. Selected documents upload after the draft is saved. You can also attach more documents in transaction history before submitting in Journal Entries. Already-booked invoices, inventory, assets and foreign currency require accountant review.</p><button type="button" [disabled]="busy()||!confirmed" (click)="save()" class="rounded bg-zinc-700 px-4 py-2 text-white">Create journal draft</button></section>
<div class="grid gap-3 md:grid-cols-3">@for(f of data().founders;track f.account_id){<article class="rounded-xl border p-4"><p>{{f.founder_name}}</p><strong class="text-2xl">{{money(f.balance_cents)}} EGP</strong><p class="text-sm">Posted net liability · {{f.code}}</p></article>}@empty{<p>No founders registered.</p>}</div>
<section><h2 class="text-xl font-semibold">Founder transaction history</h2>@for(t of data().transactions;track t.id){<article class="border-b p-3"><strong>{{founderName(t.account_id)}} · {{t.kind}} · {{money(t.amount_cents)}} EGP</strong><p>{{t.date}} · Journal #{{t.journal_id}} · {{t.posting_status}}</p><p>{{t.description}} · Evidence: {{t.evidence_reference}}</p><div class="mt-3 space-y-2">@for(a of attachments(t.id);track a.id){<button type="button" [disabled]="busy()" (click)="download(t.id,a)" class="block underline">Download {{a.filename}}</button>}<label class="block text-sm">Attach receipt or payment proof <input type="file" accept=".pdf,.jpg,.jpeg,.png" [disabled]="busy()" (change)="upload(t.id,$event)" class="block mt-1 max-w-full file:mr-3 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-2 file:text-black"></label><p class="text-xs text-zinc-500">PDF, JPG or PNG · 10 MB per file</p></div></article>}@empty{<p>No transactions recorded.</p>}</section>
<details class="rounded-xl border p-4"><summary class="cursor-pointer text-lg font-semibold">Register founder</summary><div class="mt-4 space-y-3"><p>Create a dedicated active EGP liability leaf account in Chart of Accounts first. Do not reuse supplier or tax accounts.</p><label class="block">Founder name <input [(ngModel)]="name" maxlength="120" class="rounded border bg-transparent p-2"></label><label class="block">Liability account <select [(ngModel)]="registerId" class="rounded border bg-transparent p-2"><option [ngValue]="0">Select</option>@for(a of liabilities();track a.id){<option [ngValue]="a.id">{{a.code}} · {{a.name}}</option>}</select></label><button type="button" [disabled]="busy()||!name.trim()||!registerId" (click)="register()" class="rounded bg-zinc-700 px-4 py-2 text-white">Register founder</button></div></details>
</div>`})
export class FounderAccountsComponent{
 private http=inject(HttpClient);
 private base=(['localhost','127.0.0.1'].includes(window.location.hostname)?'http://localhost:3000':'/api')+'/accounting/founders';
 data=signal<Data>({founders:[],transactions:[],accounts:[],attachments:[]});busy=signal(false);error=signal('');notice=signal('');
 liabilities=computed(()=>this.data().accounts.filter(a=>a.type==='liability'));
 selectedFiles=signal<File[]>([]);
 name='';registerId=0;kind='expense';founderId=0;otherId=0;amount:number|null=null;date=new Date().toISOString().slice(0,10);description='';evidence='';confirmed=false;requestKey=crypto.randomUUID();
 constructor(){this.load();}
 eligible(){return this.data().accounts.filter(a=>this.kind==='expense'?a.type==='expense':a.type==='asset'&&a.code.startsWith('11'));}
 money(cents:string){return (Number(cents)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
 founderName(id:number){return this.data().founders.find(f=>f.account_id===id)?.founder_name||String(id);}
 fail(e:any){this.error.set(Array.isArray(e?.error?.message)?e.error.message.join('; '):e?.error?.message||e?.message||'Request failed');this.busy.set(false);}
 load(){this.busy.set(true);this.http.get<Data>(this.base,{withCredentials:true}).subscribe({next:r=>{this.data.set(r);this.busy.set(false);},error:e=>this.fail(e)});}
 register(){if(this.busy())return;this.busy.set(true);this.error.set('');this.http.post(this.base,{name:this.name,accountId:this.registerId},{withCredentials:true}).subscribe({next:()=>{this.name='';this.registerId=0;this.notice.set('Founder registered');this.load();},error:e=>this.fail(e)});}
 selectFiles(event:Event){
  const input=event.target as HTMLInputElement, files=Array.from(input.files||[]);input.value='';
  const next=[...this.selectedFiles(),...files];
  if(next.length>10||next.some(f=>f.size===0||f.size>10*1024*1024||!(/\.(pdf|jpe?g|png)$/i.test(f.name)))){this.error.set('Choose up to 10 nonempty PDF, JPG or PNG files, maximum 10 MB each.');return;}
  this.error.set('');this.selectedFiles.set(next);
 }
 removeFile(index:number){this.selectedFiles.update(files=>files.filter((_,i)=>i!==index));}
 async save(){
  if(this.busy()||!this.confirmed)return;
  const amount=Number(this.amount)*100,cents=Math.round(amount);
  if(!this.founderId||!this.otherId||!Number.isSafeInteger(cents)||cents<=0||Math.abs(amount-cents)>0.000001||!this.description.trim()||!this.evidence.trim()){this.error.set('Complete all fields with a valid EGP amount.');return;}
  this.busy.set(true);this.error.set('');this.notice.set('');
  try{
   const result=await firstValueFrom(this.http.post<{journalId:number}>(this.base+'/transactions',{kind:this.kind,accountId:this.founderId,otherAccountId:this.otherId,amountCents:cents,date:this.date,description:this.description,evidenceReference:this.evidence,requestKey:this.requestKey},{withCredentials:true}));
   const files=this.selectedFiles();this.selectedFiles.set([]);this.amount=null;this.description='';this.evidence='';this.confirmed=false;this.requestKey=crypto.randomUUID();
   this.notice.set('Journal #'+result.journalId+' created as draft.');
   const failures:string[]=[];
   if(files.length){
    try{
     const data=await firstValueFrom(this.http.get<Data>(this.base,{withCredentials:true}));
     const transaction=data.transactions.find(t=>t.journal_id===result.journalId);
     if(!transaction)throw new Error('Saved transaction not found in history');
     for(const file of files){
      const form=new FormData();form.append('file',file);
      try{await firstValueFrom(this.http.post(this.base+'/transactions/'+transaction.id+'/evidence',form,{withCredentials:true}));}catch{failures.push(file.name);}
     }
    }catch{failures.push(...files.map(f=>f.name));}
   }
   if(failures.length)this.error.set('Draft saved. Could not attach: '+failures.join(', ')+'. Retry from transaction history; do not create another transaction.');
   else this.notice.set('Journal #'+result.journalId+' created as draft.'+(files.length?' Documents attached.':'')+' Submit for approval in Journal Entries.');
   this.load();
  }catch(e){this.fail(e);}
 }


 attachments(id:number){return this.data().attachments.filter(a=>a.transaction_id===id);}
 upload(id:number,event:Event){
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0];input.value='';
  if(!file||this.busy())return;
  if(file.size>10*1024*1024||file.size===0){this.error.set('Choose a nonempty file up to 10 MB');return;}
  const form=new FormData();form.append('file',file);
  this.busy.set(true);this.error.set('');
  this.http.post(this.base+'/transactions/'+id+'/evidence',form,{withCredentials:true}).subscribe({next:()=>{this.notice.set('Payment evidence attached');this.load();},error:e=>this.fail(e)});
 }
 download(id:number,a:Evidence){
  if(this.busy())return;
  this.busy.set(true);this.error.set('');
  this.http.get(this.base+'/transactions/'+id+'/evidence/'+a.id,{withCredentials:true,responseType:'blob'}).subscribe({next:blob=>{
   const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=a.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);this.busy.set(false);
  },error:e=>this.fail(e)});
 }
}
