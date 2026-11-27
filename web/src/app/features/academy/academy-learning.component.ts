import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AcademyApiService, AcademyLearningRow, academyError } from '../../core/services/academy-api.service';
@Component({standalone:true,imports:[RouterLink],template:`
<div class="mx-auto max-w-5xl space-y-4 p-6"><a routerLink="/academy" class="underline">← Academy</a><h1 class="text-3xl font-bold">My learning</h1>
@if(error()){<p role="alert">{{error()}}</p>}
@for(r of rows();track r.version_id){<article class="rounded-xl border p-4"><a class="font-semibold underline" [routerLink]="['/academy/processes',r.slug]">{{r.code}} · {{r.title}}</a><p class="text-sm">Version {{r.version}} · {{r.assigned?'Required':'Optional'}} · {{r.completed_at?'Completed':r.step_ids.length?'In progress':'Not started'}}</p>@if(r.due_at){<p>Due {{r.due_at}}</p>}</article>}@empty{<p>No current published lessons.</p>}</div>`})
export class AcademyLearningComponent {
 private api=inject(AcademyApiService);rows=signal<AcademyLearningRow[]>([]);error=signal('');
 constructor(){this.api.myLearning().subscribe({next:r=>this.rows.set(r),error:e=>this.error.set(academyError(e))});}
}
