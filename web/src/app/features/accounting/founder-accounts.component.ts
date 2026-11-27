import { Component, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
interface Account{id:number;code:string;name:string;type:string}
interface Founder{account_id:number;founder_name:string;code:string;balance_cents:string}
interface Transaction{id:number;account_id:number;kind:string;evidence_reference:string;journal_id:number;date:string;description:string;posting_status:string;amount_cents:string}
interface Data{founders:Founder[];transactions:Transaction[];accounts:Account[]}
@Component({standalone:true,imports:[FormsModule,RouterLink],template:`
<div class="mx-auto max-w-6xl space-y-6 p-6">
<header><h1 class="text-3xl font-bold">Founder Accounts</h1><p class="text-zinc-500">EGP local pilot · Record repayable founder funding and reimbursements through journal approval.</p><a routerLink="/accounting/journal" class="underline">Journal Entries</a> · <a routerLink="/accounting/chart-of-accounts" class="underline">Chart of Accounts</a> · <a routerLink="/academy" [queryParams]="{category:'finance'}" class="underline">Finance training</a></header>
@if(error()){<p role="alert" class="text-red-500">{{error()}}</p>}@if(notice()){<p role="status" class="text-green-500">{{notice()}}</p>}
<div class="grid gap-3 md:grid-cols-3">@for(f of data().founders;track f.account_id){<article class="rounded-xl border p-4"><p>{{f.founder_name}}</p><strong class="text-2xl">{{money(f.balance_cents)}} EGP</strong><p class="text-sm">Posted net liability · {{f.code}}</p></article>}@empty{<p>No founders registered.</p>}</div>
<section class="space-y-3 rounded-xl border p-4"><h2 class="text-xl font-semibold">Register founder</h2><p>Create a dedicated active EGP liability leaf account in Chart of Accounts first. Do not reuse supplier or tax accounts.</p><label class="block">Founder name <input [(ngModel)]="name" maxlength="120" class="rounded border bg-transparent p-2"></label><label class="block">Liability account <select [(ngModel)]="registerId" class="rounded border bg-transparent p-2"><option [ngValue]="0">Select</option>@for(a of liabilities();track a.id){<option [ngValue]="a.id">{{a.code}} · {{a.name}}</option>}</select></label><button type="button" [disabled]="busy()||!name.trim()||!registerId" (click)="register()" class="rounded bg-zinc-700 px-4 py-2 text-white">Register founder</button></section>
<section class="space-y-3 rounded-xl border p-4"><h2 class="text-xl font-semibold">Record transaction</h2><fieldset [disabled]="busy()" class="space-y-3">
<label class="block">Transaction type <select [(ngModel)]="kind" (ngModelChange)="otherId=0" class="rounded border bg-transparent p-2"><option value="expense">Founder paid expense</option><option value="loan">Founder lent money</option><option value="repayment">Company reimbursed founder</option></select></label>
<label class="block">Founder <select [(ngModel)]="founderId" class="rounded border bg-transparent p-2"><option [ngValue]="0">Select</option>@for(f of data().founders;track f.account_id){<option [ngValue]="f.account_id">{{f.founder_name}}</option>}</select></label>
<label class="block">{{kind==='expense'?'Expense category':'Company cash / bank account'}} <select [(ngModel)]="otherId" class="rounded border bg-transparent p-2"><option [ngValue]="0">Select</option>@for(a of eligible();track a.id){<option [ngValue]="a.id">{{a.code}} · {{a.name}}</option>}</select></label>
<label class="block">Amount (EGP) <input type="number" min="0.01" step="0.01" [(ngModel)]="amount" class="rounded border bg-transparent p-2"></label>
<label class="block">Transaction date <input type="date" [(ngModel)]="date" class="rounded border bg-transparent p-2"></label>
<label class="block">Business purpose <input [(ngModel)]="description" maxlength="500" class="w-full rounded border bg-transparent p-2"></label>
<label class="block">Receipt / bank evidence reference <input [(ngModel)]="evidence" maxlength="300" class="w-full rounded border bg-transparent p-2"></label>
<label class="block"><input type="checkbox" [(ngModel)]="confirmed"> Evidence retained and verified; transaction is not already recorded. Repayment has actually occurred and is approved.</label>
</fieldset><p class="text-sm text-zinc-500">Creates a journal draft only. Submit and approve in Journal Entries. Already-booked invoices, inventory, assets and foreign currency require accountant review.</p><button type="button" [disabled]="busy()||!confirmed" (click)="save()" class="rounded bg-zinc-700 px-4 py-2 text-white">Create journal draft</button></section>
<section><h2 class="text-xl font-semibold">Founder transaction history</h2>@for(t of data().transactions;track t.id){<article class="border-b p-3"><strong>{{founderName(t.account_id)}} · {{t.kind}} · {{money(t.amount_cents)}} EGP</strong><p>{{t.date}} · Journal #{{t.journal_id}} · {{t.posting_status}}</p><p>{{t.description}} · Evidence: {{t.evidence_reference}}</p></article>}@empty{<p>No transactions recorded.</p>}</section>
</div>`})
export class FounderAccountsComponent{
 private http=inject(HttpClient);
 private base=(['localhost','127.0.0.1'].includes(window.location.hostname)?'http://localhost:3000':'/api')+'/accounting/founders';
 data=signal<Data>({founders:[],transactions:[],accounts:[]});busy=signal(false);error=signal('');notice=signal('');
 liabilities=computed(()=>this.data().accounts.filter(a=>a.type==='liability'));
 name='';registerId=0;kind='expense';founderId=0;otherId=0;amount:number|null=null;date=new Date().toISOString().slice(0,10);description='';evidence='';confirmed=false;requestKey=crypto.randomUUID();
 constructor(){this.load();}
 eligible(){return this.data().accounts.filter(a=>this.kind==='expense'?a.type==='expense':a.type==='asset'&&a.code.startsWith('11'));}
 money(cents:string){return (Number(cents)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
 founderName(id:number){return this.data().founders.find(f=>f.account_id===id)?.founder_name||String(id);}
 fail(e:any){this.error.set(Array.isArray(e?.error?.message)?e.error.message.join('; '):e?.error?.message||e?.message||'Request failed');this.busy.set(false);}
 load(){this.busy.set(true);this.http.get<Data>(this.base,{withCredentials:true}).subscribe({next:r=>{this.data.set(r);this.busy.set(false);},error:e=>this.fail(e)});}
 register(){if(this.busy())return;this.busy.set(true);this.error.set('');this.http.post(this.base,{name:this.name,accountId:this.registerId},{withCredentials:true}).subscribe({next:()=>{this.name='';this.registerId=0;this.notice.set('Founder registered');this.load();},error:e=>this.fail(e)});}
 save(){if(this.busy()||!this.confirmed)return;const amount=Number(this.amount)*100,cents=Math.round(amount);if(!this.founderId||!this.otherId||!Number.isSafeInteger(cents)||cents<=0||Math.abs(amount-cents)>0.000001||!this.description.trim()||!this.evidence.trim()){this.error.set('Complete all fields with a valid EGP amount.');return;}this.busy.set(true);this.error.set('');this.http.post<{journalId:number}>(this.base+'/transactions',{kind:this.kind,accountId:this.founderId,otherAccountId:this.otherId,amountCents:cents,date:this.date,description:this.description,evidenceReference:this.evidence,requestKey:this.requestKey},{withCredentials:true}).subscribe({next:r=>{this.notice.set('Journal #'+r.journalId+' created as draft. Submit for approval in Journal Entries.');this.amount=null;this.description='';this.evidence='';this.confirmed=false;this.requestKey=crypto.randomUUID();this.load();},error:e=>this.fail(e)});}
}
