import { Body, Controller, Get, Post, Put, Param, ParseIntPipe, Req, UseGuards, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { requireAcademyRole } from './academy.policy';

const currentVersion = `v.published_at IS NOT NULL AND p.archived_at IS NULL AND NOT EXISTS
 (SELECT 1 FROM academy_process_versions n WHERE n.process_id=p.id AND n.published_at IS NOT NULL AND n.version>v.version)`;
function positive(v:unknown):number {
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<=0)throw new BadRequestException('Invalid ID');
 return v;
}
function text(v:unknown,max:number):string {
 if(typeof v!=='string'||!v.trim()||v.length>max)throw new BadRequestException('Invalid text');
 return v.trim();
}
function ids(v:unknown):number[]{
 if(!Array.isArray(v)||v.length>100)throw new BadRequestException('Invalid checklist');
 return [...new Set(v.map(positive))];
}
function bodyObject(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new BadRequestException('Invalid body');
 return v as Record<string,unknown>;
}
@Controller('academy')
@UseGuards(AuthGuard)
export class AcademyLearningController {
 constructor(private readonly db:DataSource){}
 private async actor(req:AuthenticatedRequest,admin=false){
  requireAcademyRole(req.user.role,admin);
  const [db]=await this.db.query('SELECT current_database() AS name');
  if(db?.name!=='kora_test')throw new ServiceUnavailableException('Academy pilot requires kora_test');
  return req.user;
 }
 private async version(tx:EntityManager,id:number,role:string,current=true){
  const [v]=await tx.query(`SELECT v.id FROM academy_process_versions v JOIN academy_processes p ON p.id=v.process_id
   WHERE v.id=$1 AND $2=ANY(v.allowed_roles) AND ${current?currentVersion:'v.published_at IS NOT NULL AND p.archived_at IS NULL'}`,[id,role]);
  if(!v)throw new NotFoundException('Authorized published procedure not found');
 }
 private async validateSteps(tx:EntityManager,version:number,checked:number[]){
  const steps:{id:number}[]=await tx.query('SELECT id FROM academy_steps WHERE version_id=$1',[version]);
  if(checked.some(id=>!steps.some(s=>s.id===id)))throw new BadRequestException('Step does not belong to this version');
  return steps;
 }
 @Get('my-learning')
 async learning(@Req() req:AuthenticatedRequest){
  const a=await this.actor(req);
  return this.db.query(`SELECT v.id AS version_id,p.slug,p.code,v.title,v.version,c.completed_at,t.due_at,t.id IS NOT NULL AS assigned,
    COALESCE(g.step_ids,'{}') AS step_ids
    FROM academy_process_versions v JOIN academy_processes p ON p.id=v.process_id
    LEFT JOIN academy_training_assignments t ON t.version_id=v.id AND t.user_id=$1
    LEFT JOIN academy_training_completions c ON c.version_id=v.id AND c.user_id=$1
    LEFT JOIN academy_training_progress g ON g.version_id=v.id AND g.user_id=$1
    WHERE ${currentVersion} AND $2=ANY(v.allowed_roles) ORDER BY (t.id IS NOT NULL) DESC,v.title`,[a.sub,a.role]);
 }
 @Put('training/:versionId/progress')
 async progress(@Req() req:AuthenticatedRequest,@Param('versionId',ParseIntPipe) versionId:number,@Body() body:unknown){
  const a=await this.actor(req);const checked=ids(bodyObject(body).stepIds);
  return this.db.transaction(async tx=>{
   await this.version(tx,versionId,a.role);
   await this.validateSteps(tx,versionId,checked);
   await tx.query(`INSERT INTO academy_training_progress(user_id,version_id,step_ids) VALUES($1,$2,$3)
    ON CONFLICT(user_id,version_id) DO UPDATE SET step_ids=EXCLUDED.step_ids,updated_at=now()`,[a.sub,versionId,checked]);
   return {stepIds:checked};
  });
 }
 @Get('admin/training')
 async report(@Req() req:AuthenticatedRequest){
  await this.actor(req,true);
  const users=await this.db.query("SELECT id,name,role FROM users WHERE role IN ('admin','employee') ORDER BY name");
  const versions=await this.db.query(`SELECT v.id,p.code,v.title,v.version,v.allowed_roles FROM academy_process_versions v
    JOIN academy_processes p ON p.id=v.process_id WHERE ${currentVersion} ORDER BY v.title`);
  const assignments=await this.db.query(`SELECT t.id,u.name,v.title,v.version,t.due_at,c.completed_at,
    NOT (${currentVersion}) AS outdated
    FROM academy_training_assignments t JOIN users u ON u.id=t.user_id JOIN academy_process_versions v ON v.id=t.version_id
    JOIN academy_processes p ON p.id=v.process_id LEFT JOIN academy_training_completions c ON c.user_id=t.user_id AND c.version_id=t.version_id
    ORDER BY t.assigned_at DESC`);
  const completions=await this.db.query(`SELECT u.name,v.title,v.version,c.completed_at FROM academy_training_completions c
   JOIN users u ON u.id=c.user_id JOIN academy_process_versions v ON v.id=c.version_id ORDER BY c.completed_at DESC`);
  return {users,versions,assignments,completions};
 }
 @Post('admin/training/assign')
 async assign(@Req() req:AuthenticatedRequest,@Body() body:unknown){
  const a=await this.actor(req,true), b=bodyObject(body);
  const userId=positive(b.userId),versionId=positive(b.versionId);
  let due:string|null=null;
  if(b.dueAt!==undefined&&b.dueAt!==null&&b.dueAt!==''){
   due=text(b.dueAt,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due)throw new BadRequestException('Invalid due date');
  }
  return this.db.transaction(async tx=>{
   const [u]=await tx.query("SELECT role FROM users WHERE id=$1 AND role IN ('admin','employee')",[userId]);
   if(!u)throw new NotFoundException('Internal employee not found');
   await this.version(tx,versionId,u.role);
   await tx.query(`INSERT INTO academy_training_assignments(user_id,version_id,assigned_by,due_at) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id,version_id) DO UPDATE SET due_at=EXCLUDED.due_at,assigned_by=EXCLUDED.assigned_by`,[userId,versionId,a.sub,due]);
   return {assigned:true};
  });
 }
 @Post('feedback/:versionId')
 async feedback(@Req() req:AuthenticatedRequest,@Param('versionId',ParseIntPipe) versionId:number,@Body() body:unknown){
  const a=await this.actor(req);const message=text(bodyObject(body).message,4000);
  return this.db.transaction(async tx=>{
   await this.version(tx,versionId,a.role);
   await tx.query('INSERT INTO academy_feedback(user_id,version_id,message) VALUES($1,$2,$3)',[a.sub,versionId,message]);
   return {submitted:true};
  });
 }
 @Get('admin/feedback')
 async feedbackList(@Req() req:AuthenticatedRequest){
  await this.actor(req,true);
  return this.db.query(`SELECT f.id,f.message,f.created_at,f.resolved_at,u.name,v.title,v.version FROM academy_feedback f
   LEFT JOIN users u ON u.id=f.user_id JOIN academy_process_versions v ON v.id=f.version_id ORDER BY f.created_at DESC`);
 }
 @Post('admin/feedback/:id/resolve')
 async resolve(@Req() req:AuthenticatedRequest,@Param('id',ParseIntPipe) id:number){
  const a=await this.actor(req,true);
  const [row]=await this.db.query('UPDATE academy_feedback SET resolved_at=now(),resolved_by=$1 WHERE id=$2 AND resolved_at IS NULL RETURNING id',[a.sub,id]);
  if(!row)throw new NotFoundException('Open feedback not found');
  return {resolved:true};
 }
 @Post('checklist-runs')
 async createRun(@Req() req:AuthenticatedRequest,@Body() body:unknown){
  const a=await this.actor(req),b=bodyObject(body),versionId=positive(b.versionId),label=text(b.taskLabel,180);
  return this.db.transaction(async tx=>{
   await this.version(tx,versionId,a.role);
   const [run]=await tx.query('INSERT INTO academy_checklist_runs(actor_id,version_id,task_label) VALUES($1,$2,$3) RETURNING id',[a.sub,versionId,label]);
   return run;
  });
 }
 @Get('checklist-runs')
 async runs(@Req() req:AuthenticatedRequest){
  const a=await this.actor(req);
  return this.db.query(`SELECT r.id,r.task_label,r.completed_at,v.title,v.version FROM academy_checklist_runs r
   JOIN academy_process_versions v ON v.id=r.version_id JOIN academy_processes p ON p.id=v.process_id
   WHERE r.actor_id=$1 AND $2=ANY(v.allowed_roles) AND p.archived_at IS NULL ORDER BY r.id DESC`,[a.sub,a.role]);
 }
 @Get('checklist-runs/:id')
 async run(@Req() req:AuthenticatedRequest,@Param('id',ParseIntPipe) id:number){
  const a=await this.actor(req);
  const [r]=await this.db.query('SELECT * FROM academy_checklist_runs WHERE id=$1 AND actor_id=$2',[id,a.sub]);
  if(!r)throw new NotFoundException('Checklist not found');
  await this.version(this.db.manager,r.version_id,a.role,false);
  const steps=await this.db.query(`SELECT s.id,s.title,s.instructions,s.evidence,s.app_route,(x.step_id IS NOT NULL) AS checked,x.note
   FROM academy_steps s LEFT JOIN academy_step_results x ON x.step_id=s.id AND x.run_id=$1
   WHERE s.version_id=$2 ORDER BY s.position`,[id,r.version_id]);
  return {...r,steps};
 }
 @Put('checklist-runs/:id/steps/:stepId')
 async check(@Req() req:AuthenticatedRequest,@Param('id',ParseIntPipe) id:number,@Param('stepId',ParseIntPipe) stepId:number,@Body() body:unknown){
  const a=await this.actor(req),b=bodyObject(body);
  if(typeof b.checked!=='boolean')throw new BadRequestException('Invalid check state');
  const note=b.note===undefined||b.note===''?'':text(b.note,2000);
  return this.db.transaction(async tx=>{
   const [r]=await tx.query('SELECT * FROM academy_checklist_runs WHERE id=$1 AND actor_id=$2 AND completed_at IS NULL FOR UPDATE',[id,a.sub]);
   if(!r)throw new NotFoundException('Open checklist not found');
   await this.version(tx,r.version_id,a.role,false);
   await this.validateSteps(tx,r.version_id,[stepId]);
   if(b.checked)await tx.query(`INSERT INTO academy_step_results(run_id,step_id,checked_by,note) VALUES($1,$2,$3,$4)
    ON CONFLICT(run_id,step_id) DO UPDATE SET note=EXCLUDED.note,checked_at=now()`,[id,stepId,a.sub,note]);
   else await tx.query('DELETE FROM academy_step_results WHERE run_id=$1 AND step_id=$2',[id,stepId]);
   return {saved:true};
  });
 }
 @Post('checklist-runs/:id/complete')
 async finish(@Req() req:AuthenticatedRequest,@Param('id',ParseIntPipe) id:number){
  const a=await this.actor(req);
  return this.db.transaction(async tx=>{
   const [r]=await tx.query('SELECT * FROM academy_checklist_runs WHERE id=$1 AND actor_id=$2 AND completed_at IS NULL FOR UPDATE',[id,a.sub]);
   if(!r)throw new NotFoundException('Open checklist not found');
   await this.version(tx,r.version_id,a.role,false);
   const [result]=await tx.query(`SELECT COUNT(*)::int AS total,COUNT(x.step_id)::int AS checked FROM academy_steps s
    LEFT JOIN academy_step_results x ON x.step_id=s.id AND x.run_id=$1 WHERE s.version_id=$2`,[id,r.version_id]);
   if(!result.total||result.total!==result.checked)throw new BadRequestException('Check all steps first');
   await tx.query('UPDATE academy_checklist_runs SET completed_at=now() WHERE id=$1',[id]);
   return {completed:true};
  });
 }
}
