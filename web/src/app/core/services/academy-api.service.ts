import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AcademyCategory { id:number; code:string; name:string; }
export interface AcademyStep { id?:number; title:string; instructions:string; app_route?:string|null; evidence:string; }
export interface AcademyLesson { code:string; slug:string; category_id:number; version_id:number; version:number; title:string; summary:string; trigger:string; prerequisites:string; warnings:string; success_criteria:string; steps:AcademyStep[]; completed?:boolean; video_url?:string|null; transcript?:string; step_ids?:number[]; }
export interface AcademyAdminRow { id:number; code:string; slug:string; category_id:number; version_id:number; version:number; title:string; published_at:string|null; archived_at:string|null; }
export interface AcademyVersion extends AcademyLesson { id:number; allowed_roles:string[]; published_at:string|null; }
export interface AcademyDraft { code:string; slug:string; categoryId:number; title:string; summary:string; trigger:string; prerequisites:string; warnings:string; successCriteria:string; allowedRoles:string[]; videoUrl?:string; transcript?:string; steps:{title:string; instructions:string; appRoute:string; evidence:string}[]; }
export interface AcademyLearningRow {version_id:number;slug:string;code:string;title:string;version:number;completed_at:string|null;due_at:string|null;assigned:boolean;step_ids:number[];}
export interface AcademyTrainingReport {users:{id:number;name:string;role:string}[];versions:{id:number;code:string;title:string;version:number;allowed_roles:string[]}[];assignments:{id:number;name:string;title:string;version:number;due_at:string|null;completed_at:string|null;outdated:boolean}[];completions:{name:string;title:string;version:number;completed_at:string}[];}
export interface AcademyRunRow {id:number;task_label:string;title:string;version:number;completed_at:string|null;}
export interface AcademyRun {id:number;task_label:string;completed_at:string|null;steps:(AcademyStep & {id:number;checked:boolean;note:string|null})[];}
export interface AcademyFeedback {id:number;name:string|null;title:string;version:number;message:string;created_at:string;resolved_at:string|null;}
export interface AcademySave { id:number; versionId:number; version:number; status:string; }

@Injectable({providedIn:'root'})
export class AcademyApiService {
  private http=inject(HttpClient);
  private get base(){return (['localhost','127.0.0.1'].includes(window.location.hostname)?'http://localhost:3000':'/api')+'/academy';}
  categories(){return this.http.get<AcademyCategory[]>(this.base+'/categories',{withCredentials:true});}
  processes(){return this.http.get<AcademyLesson[]>(this.base+'/processes',{withCredentials:true});}
  lesson(slug:string){return this.http.get<AcademyLesson>(this.base+'/processes/'+encodeURIComponent(slug),{withCredentials:true});}
  adminList(){return this.http.get<AcademyAdminRow[]>(this.base+'/admin/processes',{withCredentials:true});}
  adminDetail(id:number){return this.http.get<{process:AcademyAdminRow;versions:AcademyVersion[];steps:AcademyStep[]}>(this.base+'/admin/processes/'+id,{withCredentials:true});}
  save(d:AcademyDraft,id:number|null){return id===null?this.http.post<AcademySave>(this.base+'/admin/processes',d,{withCredentials:true}):this.http.put<AcademySave>(this.base+'/admin/processes/'+id+'/draft',d,{withCredentials:true});}
  publish(id:number,versionId:number){return this.http.post<AcademySave>(this.base+'/admin/processes/'+id+'/publish/'+versionId,{}, {withCredentials:true});}
  myLearning(){return this.http.get<AcademyLearningRow[]>(this.base+'/my-learning',{withCredentials:true});}
  progress(versionId:number,stepIds:number[]){return this.http.put(this.base+'/training/'+versionId+'/progress',{stepIds},{withCredentials:true});}
  trainingReport(){return this.http.get<AcademyTrainingReport>(this.base+'/admin/training',{withCredentials:true});}
  assign(userId:number,versionId:number,dueAt:string){return this.http.post(this.base+'/admin/training/assign',{userId,versionId,dueAt},{withCredentials:true});}
  feedback(versionId:number,message:string){return this.http.post(this.base+'/feedback/'+versionId,{message},{withCredentials:true});}
  feedbackList(){return this.http.get<AcademyFeedback[]>(this.base+'/admin/feedback',{withCredentials:true});}
  resolve(id:number){return this.http.post(this.base+'/admin/feedback/'+id+'/resolve',{}, {withCredentials:true});}
  runs(){return this.http.get<AcademyRunRow[]>(this.base+'/checklist-runs',{withCredentials:true});}
  run(id:number){return this.http.get<AcademyRun>(this.base+'/checklist-runs/'+id,{withCredentials:true});}
  createRun(versionId:number,taskLabel:string){return this.http.post<{id:number}>(this.base+'/checklist-runs',{versionId,taskLabel},{withCredentials:true});}
  checkRun(id:number,stepId:number,checked:boolean,note:string){return this.http.put(this.base+'/checklist-runs/'+id+'/steps/'+stepId,{checked,note},{withCredentials:true});}
  finishRun(id:number){return this.http.post(this.base+'/checklist-runs/'+id+'/complete',{}, {withCredentials:true});}
  complete(versionId:number,stepIds:number[]){return this.http.post<{completed:boolean}>(this.base+'/training/'+versionId+'/complete',{stepIds},{withCredentials:true});}
}
export function academyError(e:unknown):string {
 const error=e as {error?:{message?:string|string[]};message?:string};
 const m=error?.error?.message;return Array.isArray(m)?m.join('; '):m||error?.message||'Academy request failed';
}
