import { MigrationInterface, QueryRunner } from 'typeorm';

export class FounderEvidenceTraining1795770006000 implements MigrationInterface {
 name='FounderEvidenceTraining1795770006000';
 async up(q:QueryRunner):Promise<void>{
  const [db]=await q.query('SELECT current_database() AS name');
  if(db?.name!=='kora_test')throw new Error('Founder evidence training requires kora_test');
  for(const code of ['FIN-009','FIN-010','FIN-011']){
   const [p]=await q.query('SELECT id FROM academy_processes WHERE code=$1 AND archived_at IS NULL FOR UPDATE',[code]);
   if(!p)continue;
   const [v]=await q.query('SELECT * FROM academy_process_versions WHERE process_id=$1 ORDER BY version DESC LIMIT 1',[p.id]);
   if(!v)continue;
   const steps=await q.query('SELECT * FROM academy_steps WHERE version_id=$1 ORDER BY position',[v.id]);
   if(steps.some((s:{title:string})=>s.title==='Attach payment evidence'))continue;
   let target=v.id;
   if(v.published_at){
    const [draft]=await q.query(`INSERT INTO academy_process_versions(process_id,version,title,summary,trigger,prerequisites,warnings,success_criteria,video_url,transcript,allowed_roles,created_by)
     SELECT process_id,version+1,title,summary,trigger,prerequisites,warnings,success_criteria,video_url,transcript,allowed_roles,0 FROM academy_process_versions WHERE id=$1 RETURNING id`,[v.id]);
    target=draft.id;
   }else{
    await q.query('DELETE FROM academy_steps WHERE version_id=$1',[target]);
   }
   const index=steps.findIndex((s:{title:string})=>/review.*(draft|submit)/i.test(s.title));
   steps.splice(index<0?steps.length:index,0,{title:'Attach payment evidence',instructions:'After saving the journal draft, find the transaction in Founder Accounts history. Attach the receipt, invoice or bank payment proof as PDF, JPG or PNG (up to 10 MB per file). Download the saved attachment to verify it before submitting the journal. Retain original evidence.',app_route:'/accounting/founders',evidence:'Saved payment proof'});
   for(const [i,s] of steps.entries())await q.query('INSERT INTO academy_steps(version_id,position,title,instructions,app_route,evidence) VALUES($1,$2,$3,$4,$5,$6)',[target,i+1,s.title,s.instructions,s.app_route,s.evidence||'']);
  }
 }
 async down():Promise<void>{throw new Error('Reviewed backup restore required for Academy content');}
}
