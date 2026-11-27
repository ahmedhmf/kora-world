import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AcademyApiService, AcademyTrainingReport, AcademyFeedback, academyError } from '../../core/services/academy-api.service';
@Component({standalone:true,imports:[FormsModule,RouterLink],template:`
<div class="mx-auto max-w-6xl space-y-5 p-6"><a routerLink="/academy/admin" class="underline">← Manage Academy</a><h1 class="text-3xl font-bold">Training management</h1>
@if(error()){<p role="alert" class="text-red-600">{{error()}}</p>}@if(notice()){<p role="status">{{notice()}}</p>}
@if(report();as r){<section class="space-y-3 rounded-xl border p-4"><h2 class="font-semibold">Assign current published training / retraining</h2><label class="block">Employee<select [(ngModel)]="userId" class="ml-2 rounded border bg-transparent p-2"><option [ngValue]="0">Select employee</option>@for(u of r.users;track u.id){<option [ngValue]="u.id">{{u.name}} ({{u.role}})</option>}</select></label><label class="block">Lesson<select [(ngModel)]="versionId" class="ml-2 rounded border bg-transparent p-2"><option [ngValue]="0">Select procedure</option>@for(v of r.versions;track v.id){<option [ngValue]="v.id">{{v.code}} {{v.title}} v{{v.version}}</option>}</select></label><label>Due date (optional) <input type="date" [(ngModel)]="dueAt" class="rounded border p-2 bg-transparent"></label><button type="button" [disabled]="busy()||!userId||!versionId" (click)="assign()" class="ml-2 rounded bg-zinc-900 px-4 py-2 text-white">Assign</button></section>
<section><h2 class="text-xl font-semibold">Assignments</h2>@for(a of r.assignments;track a.id){<div class="border-b p-3">{{a.name}} · {{a.title}} v{{a.version}} · {{a.completed_at?'Completed':'Pending'}} @if(a.outdated){<strong> · Previous version</strong>} @if(a.due_at){<span> · Due {{a.due_at}}</span>}</div>}@empty{<p>No assignments.</p>}</section>
<section><h2 class="text-xl font-semibold">Completion history</h2>@for(c of r.completions;track $index){<div class="border-b p-3">{{c.name}} · {{c.title}} v{{c.version}} · {{c.completed_at}}</div>}@empty{<p>No completions.</p>}</section>}
<section><h2 class="text-xl font-semibold">Procedure feedback</h2>@for(f of feedback();track f.id){<article class="rounded border p-3"><strong>{{f.title}} v{{f.version}} · {{f.name}}</strong><p class="whitespace-pre-wrap">{{f.message}}</p>@if(f.resolved_at){<p>Resolved</p>}@else{<button type="button" [disabled]="busy()" (click)="resolve(f.id)" class="underline">Mark resolved</button>}</article>}@empty{<p>No feedback.</p>}</section></div>`})
export class AcademyTrainingAdminComponent {
 private api=inject(AcademyApiService);report=signal<AcademyTrainingReport|null>(null);feedback=signal<AcademyFeedback[]>([]);busy=signal(false);error=signal('');notice=signal('');userId=0;versionId=0;dueAt='';
 constructor(){this.load();}
 load(){this.busy.set(true);forkJoin({report:this.api.trainingReport(),feedback:this.api.feedbackList()}).subscribe({next:r=>{this.report.set(r.report);this.feedback.set(r.feedback);this.busy.set(false);},error:e=>this.fail(e)});}
 fail(e:unknown){this.error.set(academyError(e));this.busy.set(false);}
 assign(){if(this.busy())return;this.busy.set(true);this.error.set('');this.api.assign(this.userId,this.versionId,this.dueAt).subscribe({next:()=>{this.notice.set('Training assigned');this.load();},error:e=>this.fail(e)});}
 resolve(id:number){if(this.busy())return;this.busy.set(true);this.api.resolve(id).subscribe({next:()=>this.load(),error:e=>this.fail(e)});}
}
