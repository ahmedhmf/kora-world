import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AcademyApiService, AcademyRun, AcademyRunRow, academyError } from '../../core/services/academy-api.service';
@Component({standalone:true,imports:[RouterLink,FormsModule],template:`
<div class="mx-auto max-w-4xl space-y-4 p-6"><a routerLink="/academy" class="underline">← Academy</a><h1 class="text-3xl font-bold">My operational checklists</h1><p>Personal task records only; no business approval or inventory action is performed.</p>@if(error()){<p role="alert">{{error()}}</p>}
@if(run();as r){<button type="button" (click)="back()" [disabled]="busy()" class="underline">← All checklists</button><h2 class="text-xl font-semibold">{{r.task_label}}</h2>@for(s of r.steps;track s.id){<article class="space-y-2 rounded border p-4"><strong>{{s.title}}</strong><p>{{s.instructions}}</p>@if(s.evidence){<p>Evidence: {{s.evidence}}</p>}@if(s.app_route){<a [routerLink]="s.app_route" target="_blank" rel="noopener" class="underline">Open screen</a>}<label class="block">Note<input [(ngModel)]="s.note" [disabled]="busy()||!!r.completed_at" class="ml-2 rounded border p-2 bg-transparent"></label><button type="button" [disabled]="busy()||!!r.completed_at" (click)="check(r.id,s.id,!s.checked,s.note||'')" class="rounded border px-3 py-2">{{s.checked?'Uncheck':'Mark checked'}}</button>@if(s.checked){<button type="button" [disabled]="busy()||!!r.completed_at" (click)="check(r.id,s.id,true,s.note||'')" class="ml-2 underline">Save note</button>}</article>}@if(r.completed_at){<p>Checklist completed.</p>}@else{<button type="button" [disabled]="busy()||!allChecked()" (click)="finish(r.id)" class="rounded bg-zinc-900 px-4 py-2 text-white">Complete checklist</button>}}
@else{@for(r of rows();track r.id){<button type="button" [disabled]="busy()" (click)="open(r.id)" class="block w-full rounded border p-4 text-left">{{r.task_label}} · {{r.title}} v{{r.version}} · {{r.completed_at?'Complete':'Open'}}</button>}@empty{<p>Create a checklist from a published procedure.</p>}}</div>`})
export class AcademyRunsComponent{
 private api=inject(AcademyApiService);rows=signal<AcademyRunRow[]>([]);run=signal<AcademyRun|null>(null);busy=signal(false);error=signal('');
 constructor(){this.back();}
 fail(e:unknown){this.error.set(academyError(e));this.busy.set(false);}
 back(){this.run.set(null);this.busy.set(true);this.api.runs().subscribe({next:r=>{this.rows.set(r);this.busy.set(false);},error:e=>this.fail(e)});}
 open(id:number){this.busy.set(true);this.api.run(id).subscribe({next:r=>{this.run.set(r);this.busy.set(false);},error:e=>this.fail(e)});}
 allChecked(){const s=this.run()?.steps||[];return s.length>0&&s.every(x=>x.checked);}
 check(id:number,stepId:number,checked:boolean,note:string){if(this.busy())return;this.busy.set(true);this.api.checkRun(id,stepId,checked,note).subscribe({next:()=>this.open(id),error:e=>this.fail(e)});}
 finish(id:number){if(this.busy())return;this.busy.set(true);this.api.finishRun(id).subscribe({next:()=>this.open(id),error:e=>this.fail(e)});}
}
