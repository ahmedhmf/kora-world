import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AcademyCategory { id:number; code:string; name:string; }
export interface AcademyStep { id?:number; title:string; instructions:string; app_route?:string|null; evidence:string; }
export interface AcademyLesson { code:string; slug:string; category_id:number; version_id:number; version:number; title:string; summary:string; trigger:string; prerequisites:string; warnings:string; success_criteria:string; steps:AcademyStep[]; completed?:boolean; }
export interface AcademyAdminRow { id:number; code:string; slug:string; category_id:number; version_id:number; version:number; title:string; published_at:string|null; archived_at:string|null; }
export interface AcademyVersion extends AcademyLesson { id:number; allowed_roles:string[]; published_at:string|null; }
export interface AcademyDraft { code:string; slug:string; categoryId:number; title:string; summary:string; trigger:string; prerequisites:string; warnings:string; successCriteria:string; allowedRoles:string[]; steps:{title:string; instructions:string; appRoute:string; evidence:string}[]; }
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
  complete(versionId:number,stepIds:number[]){return this.http.post<{completed:boolean}>(this.base+'/training/'+versionId+'/complete',{stepIds},{withCredentials:true});}
}
export function academyError(e:unknown):string {
 const error=e as {error?:{message?:string|string[]};message?:string};
 const m=error?.error?.message;return Array.isArray(m)?m.join('; '):m||error?.message||'Academy request failed';
}
