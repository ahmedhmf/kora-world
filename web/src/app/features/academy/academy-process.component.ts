import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AcademyApiService, AcademyLesson, academyError } from '../../core/services/academy-api.service';

@Component({standalone:true,imports:[RouterLink],templateUrl:'./academy-process.component.html'})
export class AcademyProcessComponent {
 private api=inject(AcademyApiService);
 private route=inject(ActivatedRoute);
 lesson=signal<AcademyLesson|null>(null);
 checked=signal<number[]>([]);
 loading=signal(true);
 busy=signal(false);
 error=signal('');
 constructor(){this.api.lesson(this.route.snapshot.paramMap.get('slug')||'').subscribe({next:l=>{this.lesson.set(l);this.loading.set(false);},error:e=>{this.error.set(academyError(e));this.loading.set(false);}});}
 toggle(id:number|undefined,on:boolean){if(id===undefined)return;this.checked.update(ids=>on?[...new Set([...ids,id])]:ids.filter(x=>x!==id));}
 complete(){const l=this.lesson();if(!l||this.busy()||!l.steps.length||this.checked().length!==l.steps.length)return;this.busy.set(true);this.error.set('');this.api.complete(l.version_id,this.checked()).subscribe({next:()=>{this.lesson.update(v=>v?{...v,completed:true}:v);this.busy.set(false);},error:e=>{this.error.set(academyError(e));this.busy.set(false);}});}
}
