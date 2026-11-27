import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AcademyApiService, AcademyCategory, AcademyLesson, academyError } from '../../core/services/academy-api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({standalone:true,imports:[RouterLink,FormsModule],templateUrl:'./academy-home.component.html'})
export class AcademyHomeComponent {
 readonly auth=inject(AuthService);
 private api=inject(AcademyApiService);
 categories=signal<AcademyCategory[]>([]);
 lessons=signal<AcademyLesson[]>([]);
 category=signal<number|null>(null);
 search=signal('');
 loading=signal(true);
 error=signal('');
 filtered=computed(()=>this.lessons().filter(l=>(this.category()===null||l.category_id===this.category())&&[l.title,l.code,l.summary,this.categories().find(c=>c.id===l.category_id)?.name||''].join(' ').toLowerCase().includes(this.search().trim().toLowerCase())));
 constructor(){forkJoin({categories:this.api.categories(),lessons:this.api.processes()}).subscribe({next:r=>{this.categories.set(r.categories);this.lessons.set(r.lessons);this.loading.set(false);},error:e=>{this.error.set(academyError(e));this.loading.set(false);}});}
 count(id:number){return this.lessons().filter(l=>l.category_id===id).length;}
}
