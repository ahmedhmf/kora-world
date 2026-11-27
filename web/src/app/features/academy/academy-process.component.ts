import { FormsModule } from '@angular/forms';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AcademyApiService, AcademyLesson, academyError } from '../../core/services/academy-api.service';

@Component({standalone:true,imports:[RouterLink,FormsModule],templateUrl:'./academy-process.component.html'})
export class AcademyProcessComponent {
 private api=inject(AcademyApiService);
 private route=inject(ActivatedRoute);
 lesson=signal<AcademyLesson|null>(null);
 checked=signal<number[]>([]);
 loading=signal(true);
 busy=signal(false);
 error=signal('');
 notice=signal('');
 feedbackText='';
 taskLabel='';
 constructor(){this.api.lesson(this.route.snapshot.paramMap.get('slug')||'').subscribe({next:l=>{this.lesson.set(l);this.checked.set(l.completed?l.steps.map(s=>s.id).filter((id):id is number=>id!==undefined):l.step_ids||[]);this.loading.set(false);},error:e=>{this.error.set(academyError(e));this.loading.set(false);}});}
 toggle(id:number|undefined,on:boolean){if(id===undefined||this.busy()||this.lesson()?.completed)return;this.checked.update(ids=>on?[...new Set([...ids,id])]:ids.filter(x=>x!==id));}
 saveProgress(){const l=this.lesson();if(!l||this.busy())return;this.busy.set(true);this.error.set('');this.api.progress(l.version_id,this.checked()).subscribe({next:()=>{this.notice.set('Progress saved');this.busy.set(false);},error:e=>{this.error.set(academyError(e));this.busy.set(false);}});}
 report(){const l=this.lesson();if(!l||this.busy()||!this.feedbackText.trim())return;this.busy.set(true);this.api.feedback(l.version_id,this.feedbackText).subscribe({next:()=>{this.feedbackText='';this.notice.set('Feedback submitted');this.busy.set(false);},error:e=>{this.error.set(academyError(e));this.busy.set(false);}});}
 startRun(){const l=this.lesson();if(!l||this.busy()||!this.taskLabel.trim())return;this.busy.set(true);this.api.createRun(l.version_id,this.taskLabel).subscribe({next:()=>{this.taskLabel='';this.notice.set('Operational checklist created. Open My checklists to continue.');this.busy.set(false);},error:e=>{this.error.set(academyError(e));this.busy.set(false);}});}
 complete(){const l=this.lesson();if(!l||this.busy()||!l.steps.length||this.checked().length!==l.steps.length)return;this.busy.set(true);this.error.set('');this.api.complete(l.version_id,this.checked()).subscribe({next:()=>{this.lesson.update(v=>v?{...v,completed:true}:v);this.busy.set(false);},error:e=>{this.error.set(academyError(e));this.busy.set(false);}});}
}
