import { DataSource } from 'typeorm';
import { academyReleaseMigrations } from '../academy/academy-release.policy';
import { AcademyFoundation1795770000000 } from '../migrations/1795770000000-AcademyFoundation';
import { AcademyStarterDrafts1795770001000 } from '../migrations/1795770001000-AcademyStarterDrafts';
import { AcademyLearning1795770002000 } from '../migrations/1795770002000-AcademyLearning';
import { FounderAccounts1795770003000 } from '../migrations/1795770003000-FounderAccounts';
import { FounderAcademyDrafts1795770004000 } from '../migrations/1795770004000-FounderAcademyDrafts';
import { FounderEvidence1795770005000 } from '../migrations/1795770005000-FounderEvidence';
import { FounderEvidenceTraining1795770006000 } from '../migrations/1795770006000-FounderEvidenceTraining';

const release = [AcademyFoundation1795770000000, AcademyStarterDrafts1795770001000,
 AcademyLearning1795770002000, FounderAccounts1795770003000, FounderAcademyDrafts1795770004000,
 FounderEvidence1795770005000, FounderEvidenceTraining1795770006000];
const expectedTables = ['academy_categories','academy_processes','academy_process_versions','academy_steps',
 'academy_training_completions','academy_training_assignments','academy_training_progress','academy_feedback',
 'academy_checklist_runs','academy_step_results','founder_accounts','founder_transactions','founder_evidence'];
async function main(){
 const database=process.env.DATABASE_NAME||process.env.DB_NAME;
 if(database!=='kora_world'&&database!=='kora_test')throw new Error('Unexpected target database');
 const apply=process.argv.includes('--apply');
 if(apply && process.env.KORA_ACADEMY_EXPLICIT_MIGRATION!=='approved')throw new Error('Explicit migration approval required');
 const db=new DataSource({
  type:'postgres',host:process.env.DATABASE_HOST||'localhost',port:Number(process.env.DATABASE_PORT||5432),
  username:process.env.DATABASE_USER||process.env.DB_USER,password:process.env.DATABASE_PASSWORD||process.env.DB_PASSWORD,
  database,entities:[],migrations:release,migrationsRun:false,synchronize:false,
 });
 await db.initialize();
 const q=db.createQueryRunner();
 try{
  await q.connect();
  const [identity]=await q.query('SELECT current_database() AS name');
  if(identity?.name!==database)throw new Error('Database identity mismatch');
  // Keep the lock on a dedicated connection until migration completes.
  const [lock]=await q.query('SELECT pg_try_advisory_lock(1795770000) AS acquired');
  if(!lock?.acquired)throw new Error('Another Academy release process is running');
  const prerequisiteNames=['AddAccountingPostingFoundation1794355200000','AddJournalApprovalWorkflow1794441600000'];
  const history:{name:string}[]=await q.query('SELECT name FROM migrations WHERE name=ANY($1::text[])',[[...academyReleaseMigrations,...prerequisiteNames]]);
  if(prerequisiteNames.some(name=>!history.some(h=>h.name===name)))throw new Error('Accounting prerequisite migration missing');
  const columns:{column_name:string}[]=await q.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_entries'");
  for(const name of ['id','posting_status','source_event_key','posted_at','reversal_of_id','created_by_id','submitted_by_id','submitted_at','approved_by_id','reversed_by_id','reversed_at']){
   if(!columns.some(c=>c.column_name===name))throw new Error('Missing journal column: '+name);
  }
  const tables:{tablename:string}[]=await q.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'academy_%' OR tablename LIKE 'founder_%')");
  const applied=history.filter(h=>(academyReleaseMigrations as readonly string[]).includes(h.name)).length;
  if(applied!==0&&applied!==release.length)throw new Error('Partial release history; manual review required');
  if(applied===0&&tables.length)throw new Error('Existing pilot tables without release history; manual review required');
  if(applied===release.length&&expectedTables.some(name=>!tables.some(t=>t.tablename===name)))throw new Error('Applied release schema is incomplete');
  console.log(JSON.stringify({database,applied,pending:release.length-applied,tables:tables.map(t=>t.tablename),mode:apply?'apply':'check'}));
  if(apply&&applied===0){
   const result=await db.runMigrations({transaction:'all'});
   console.log('Applied migrations:',result.map(m=>m.name));
  }
 }finally{
  await q.release();
  await db.destroy();
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
