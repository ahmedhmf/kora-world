import { MigrationInterface, QueryRunner } from 'typeorm';
import { requireAcademyMigrationTarget } from '../academy/academy-release.policy';

const lessons=[
 {code:'FIN-009',slug:'founder-paid-expense',title:'Record an expense paid by a founder',trigger:'A founder pays a legitimate Kora operating expense with personal funds.',pre:'Receipt, personal payment proof, approved business purpose, dedicated EGP founder liability account and expense category.',warn:'Do not use Money Out or record the expense twice. Already-booked supplier invoices, assets, inventory, foreign currency and tax treatment require accountant review.',done:'Journal posted, evidence retained and founder liability increased without changing company cash.',steps:[
 ['Verify evidence','Collect original receipt and proof of personal payment. Confirm no duplicate or previously booked invoice.','/accounting/founders'],
 ['Register founder if needed','Create a dedicated active EGP liability leaf account in Chart of Accounts and register it in Founder Accounts.','/accounting/chart-of-accounts'],
 ['Record expense','Open Founder Accounts, choose Founder paid expense, select founder and expense category, enter date, amount, purpose and unique evidence reference.','/accounting/founders'],
 ['Review generated draft','Confirm debit to expense and credit to founder liability. Submit journal for independent approval.','/accounting/journal'],
 ['Verify balance','After authorized posting, confirm outstanding founder balance and retain supporting documents.','/accounting/founders']]},
 {code:'FIN-010',slug:'founder-loan',title:'Record money lent to the company',trigger:'Founder transfers repayable personal funds into company cash or bank.',pre:'Actual company receipt, bank proof or cash receipt, agreed repayment terms and registered founder liability account.',warn:'Do not record repayable funding as revenue. Permanent capital contributions, interest and foreign currency require accountant review.',done:'Posted journal increases company cash and founder liability by the same EGP amount.',steps:[
 ['Verify funds received','Check actual bank credit or cash receipt and agreed loan terms.','/accounting/founders'],
 ['Record funding','Choose Founder lent money; select founder and receiving company cash/bank account. Enter actual date, amount and evidence reference.','/accounting/founders'],
 ['Review and submit','Confirm debit to company cash/bank and credit to founder liability; submit for independent approval.','/accounting/journal'],
 ['Verify posted balances','Reconcile company cash and founder liability after posting.','/accounting/founders']]},
 {code:'FIN-011',slug:'reimburse-founder',title:'Reimburse a founder',trigger:'Company has approved repayment of an outstanding founder liability.',pre:'Posted outstanding balance, sufficient available cash, repayment approval and proof of actual transfer.',warn:'Do not pay more than the approved outstanding liability. Do not record the original expense again. Check pending repayments before transferring money.',done:'Actual repayment documented and posted; founder liability and company cash reduced once.',steps:[
 ['Review outstanding balance','Check posted balance, pending repayments and available cash before approving payment.','/accounting/founders'],
 ['Obtain approval and pay','Obtain independent approval, transfer approved amount and retain bank proof. This screen does not execute payment.','/accounting/founders'],
 ['Record reimbursement','Choose Company reimbursed founder; select founder and paying company bank/cash account, amount, actual date and evidence.','/accounting/founders'],
 ['Review and submit','Confirm debit to founder liability and credit to company cash/bank. Submit for independent journal approval.','/accounting/journal'],
 ['Reconcile remaining balance','Verify posted balance and bank movement. Escalate mismatches rather than posting another expense.','/accounting/founders']]}
];
export class FounderAcademyDrafts1795770004000 implements MigrationInterface {
 name='FounderAcademyDrafts1795770004000';
 async up(q:QueryRunner):Promise<void>{
  await requireAcademyMigrationTarget(q);
  const [category]=await q.query("SELECT id FROM academy_categories WHERE code='finance'");
  if(!category)throw new Error('Finance Academy category missing');
  for(const s of lessons){
   const [p]=await q.query('INSERT INTO academy_processes(code,slug,category_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[s.code,s.slug,category.id]);
   if(!p)continue;
   const [v]=await q.query(`INSERT INTO academy_process_versions(process_id,version,title,summary,trigger,prerequisites,warnings,success_criteria,allowed_roles,created_by)
     VALUES($1,1,$2,$3,$3,$4,$5,$6,ARRAY['admin']::text[],0) RETURNING id`,[p.id,s.title,s.trigger,s.pre,s.warn,s.done]);
   for(const [i,step] of s.steps.entries())await q.query('INSERT INTO academy_steps(version_id,position,title,instructions,app_route) VALUES($1,$2,$3,$4,$5)',[v.id,i+1,...step]);
  }
 }
 async down():Promise<void>{throw new Error('Reviewed backup restore required for Academy content');}
}
