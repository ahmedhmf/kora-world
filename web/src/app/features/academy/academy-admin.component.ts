import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AcademyApiService, AcademyCategory, AcademyAdminRow, AcademyDraft, AcademySave, academyError } from '../../core/services/academy-api.service';

const emptyStep=()=>({title:'',instructions:'',appRoute:'',evidence:''});
const emptyDraft=():AcademyDraft=>({code:'',slug:'',categoryId:0,title:'',summary:'',trigger:'',prerequisites:'',warnings:'',successCriteria:'',allowedRoles:['admin','employee'],steps:[emptyStep()]});
@Component({standalone:true,imports:[FormsModule,RouterLink],templateUrl:'./academy-admin.component.html'})
export class AcademyAdminComponent {
 private api=inject(AcademyApiService);
 categories=signal<AcademyCategory[]>([]);
 rows=signal<AcademyAdminRow[]>([]);
 busy=signal(false);
 error=signal('');
 notice=signal('');
 editing=signal(false);
 id:number|null=null;
 draft=emptyDraft();
 saved:AcademySave|null=null;
 routes=['/suppliers','/products','/purchase-orders','/purchase-orders/new','/accounts','/warehouse','/warehouse/equipment','/calendar','/experiences','/accounting/simple'];
 constructor(){this.reload();}
 reload(){this.busy.set(true);forkJoin({categories:this.api.categories(),rows:this.api.adminList()}).subscribe({next:r=>{this.categories.set(r.categories);this.rows.set(r.rows);this.busy.set(false);},error:e=>this.failed(e)});}
 failed(e:unknown){this.error.set(academyError(e));this.busy.set(false);}
 start(){this.id=null;this.saved=null;this.draft=emptyDraft();this.draft.categoryId=this.categories()[0]?.id||0;this.error.set('');this.notice.set('');this.editing.set(true);}
 open(id:number){this.busy.set(true);this.error.set('');this.notice.set('');this.api.adminDetail(id).subscribe({next:r=>{const v=r.versions[0];this.id=id;this.saved=v?{id,versionId:v.id,version:v.version,status:v.published_at?'published':'draft'}:null;this.draft={code:r.process.code,slug:r.process.slug,categoryId:r.process.category_id,title:v?.title||'',summary:v?.summary||'',trigger:v?.trigger||'',prerequisites:v?.prerequisites||'',warnings:v?.warnings||'',successCriteria:v?.success_criteria||'',allowedRoles:v?.allowed_roles||['admin','employee'],steps:r.steps.map(s=>({title:s.title,instructions:s.instructions,appRoute:s.app_route||'',evidence:s.evidence}))};this.editing.set(true);this.busy.set(false);},error:e=>this.failed(e)});}
 changed(){this.saved=null;this.notice.set('');}
 role(role:string,on:boolean){this.draft.allowedRoles=on?[...new Set([...this.draft.allowedRoles,role])]:this.draft.allowedRoles.filter(r=>r!==role);this.changed();}
 add(){this.draft.steps.push(emptyStep());this.changed();}
 remove(i:number){this.draft.steps.splice(i,1);this.changed();}
 move(i:number,delta:number){const j=i+delta;if(j<0||j>=this.draft.steps.length)return;const a=this.draft.steps;[a[i],a[j]]=[a[j],a[i]];this.changed();}
 save(){if(this.busy())return;this.error.set('');this.busy.set(true);this.api.save(this.draft,this.id).subscribe({next:r=>{this.id=r.id;this.saved=r;this.notice.set('Draft version '+r.version+' saved.');this.reload();},error:e=>this.failed(e)});}
 publish(){const s=this.saved;if(!s||s.status!=='draft'||this.busy())return;this.busy.set(true);this.error.set('');this.api.publish(s.id,s.versionId).subscribe({next:r=>{this.saved=r;this.notice.set('Version '+r.version+' published.');this.reload();},error:e=>this.failed(e)});}
 close(){this.editing.set(false);this.saved=null;this.notice.set('');this.error.set('');}
}
