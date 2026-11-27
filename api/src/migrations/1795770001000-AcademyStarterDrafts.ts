import { MigrationInterface, QueryRunner } from 'typeorm';
import { requireAcademyMigrationTarget } from '../academy/academy-release.policy';

type Step = [string,string,string?,string?];
type Starter = {code:string;slug:string;category:string;title:string;trigger:string;prerequisites:string;warnings:string;done:string;steps:Step[];finance?:boolean};
const starters: Starter[] = [
 {code:'PUR-002',slug:'order-footballs',category:'purchasing',title:'Order footballs',trigger:'Purchasing manager authorizes replenishment.',prerequisites:'Approved supplier, article number, quantity, price, currency and delivery date.',warnings:'Stop for supplier, SKU, currency or price mismatches. Do not mark received until physically verified. Avoid duplicate finance postings.',done:'Accurate PO reference, correct status and documented receiving handoff.',steps:[
 ['Verify supplier','Check supplier, trading currency and lead time.','/suppliers'],
 ['Verify product','Confirm article, price and supplier association.','/products'],
 ['Create purchase order','Enter supplier, order and expected delivery dates, product quantities and relevant notes.','/purchase-orders/new'],
 ['Save and obtain approval','Review totals and obtain manager approval before sending.','/purchase-orders','Approved PO'],
 ['Track shipment','Update sent, confirmed and shipped statuses only when supported by evidence; record carrier and tracking.','/purchase-orders'],
 ['Receiving handoff','Follow WH-001 before marking received. Route supplier invoice to finance.','/purchase-orders']]},
 {code:'WH-001',slug:'receive-footballs',category:'warehouse',title:'Physically receive footballs',trigger:'Boxes arrive from supplier.',prerequisites:'PO, packing list and actual shipment.',warnings:'Stop on shortages, damage or unexpected SKUs. Verify actual warehouse posting separately; PO status alone is not evidence.',done:'Count and condition confirmed, exceptions documented, manager review and correct PO status.',steps:[
 ['Find purchase order','Match supplier and expected products.','/purchase-orders'],
 ['Count and inspect','Check actual quantities, article numbers and damage.','','Count and exception record'],
 ['Confirm receipt','Obtain manager confirmation and update PO only after inspection.','/purchase-orders'],
 ['Verify stock','Review authoritative warehouse records if supported.','/warehouse']]},
 {code:'LOG-001',slug:'dispatch-footballs',category:'warehouse',title:'Dispatch footballs to a customer',trigger:'Approved customer supply instruction.',prerequisites:'Correct account, verified address, physical stock and dispatch authorization.',warnings:'Courier waybill is separate from Kora signed delivery note. Do not assume customer receipt.',done:'Saved delivery note, official PDF, dispatch record and courier reference.',steps:[
 ['Verify customer','Open correct account and confirm delivery address and payment model.','/accounts'],
 ['Create delivery note','Open account Delivery Notes, enter date, SKUs, quantities and remarks; save.','/accounts'],
 ['Download official PDF','Compare customer, SKU and quantity with packing list.','/accounts'],
 ['Pack and dispatch','Double-count balls and retain waybill or tracking evidence.','','Waybill and packing evidence']]},
 {code:'LOG-002',slug:'proof-of-delivery',category:'warehouse',title:'Obtain proof of delivery',trigger:'Customer receives balls.',prerequisites:'Saved delivery note and transport reference.',warnings:'Escalate unsigned, refused, short or damaged shipments. Do not create a duplicate delivery note.',done:'Signed document attached to correct delivery note; account inventory reconciled.',steps:[
 ['Obtain signature','Collect signed Kora delivery note or approved proof.','','Signed delivery note'],
 ['Upload signed copy','Open the same account delivery note and upload the signed copy.','/accounts'],
 ['Verify inventory','Check signed status and customer-held stock.','/accounts']]},
 {code:'SAL-003',slug:'record-customer-sales',category:'sales',title:'Record customer sales',trigger:'Partner sends sales statement.',prerequisites:'Correct account, signed deliveries and original sales report.',warnings:'Do not approve quantities exceeding available stock. Do not record payment until received.',done:'Approved sales report, reconciled stock and verified settlement.',steps:[
 ['Check account inventory','Confirm signed deliveries and current stock.','/accounts'],
 ['Enter sales report','Select reporting period, correct SKU, quantity and applicable price; retain source report.','/accounts','Partner sales statement'],
 ['Review and approve','Use authorized sales approval workflow.','/accounts'],
 ['Verify settlement','Check remaining stock and customer financial overview.','/accounts']]},
 {code:'FIN-002',slug:'record-customer-payment',category:'finance',title:'Record customer payment',trigger:'Confirmed customer payment received.',prerequisites:'Bank evidence, customer account, amount, currency and unique reference.',warnings:'Do not duplicate payment in Simple Accounting or another module.',done:'One recorded payment with verified bank reference.',finance:true,steps:[
 ['Verify payment','Check bank evidence and customer identity.','','Bank proof'],
 ['Record payment','Open customer financials and enter actual date, amount, currency and reference.','/accounts'],
 ['Review credit','Verify recorded payment and unallocated credit; follow FIN-003.','/accounts']]},
 {code:'FIN-003',slug:'allocate-customer-payment',category:'finance',title:'Allocate customer payment',trigger:'Recorded payment must settle customer sales.',prerequisites:'Existing payment and correct outstanding settlement.',warnings:'Do not over-allocate or apply to the wrong account. Escalate reversals.',done:'Correct allocation and remaining balance verified.',finance:true,steps:[
 ['Find settlement','Check outstanding settlement and payment credit.','/accounts'],
 ['Allocate payment','Use existing allocation workflow with correct amount.','/accounts'],
 ['Verify balances','Review settlement outstanding and remaining credit.','/accounts']]},
 {code:'FIN-004',slug:'record-operating-expense',category:'finance',title:'Record operating expense',trigger:'Authorized standalone operating payment.',prerequisites:'Receipt, bank proof, business purpose and approval.',warnings:'Accounting redesign remains a local pilot. Do not duplicate supplier invoices/payments or post unsupported transactions.',done:'One authorized expense posting with evidence, verified against ledger.',finance:true,steps:[
 ['Check for duplicates','Confirm payment was not already recorded through another finance workflow.','','Receipt and bank proof'],
 ['Enter Money Out','Verify date, cash/bank account, expense category, amount, currency and description.','/accounting/simple'],
 ['Review authorized posting','Use actual approval workflow and verify journal status.','/accounting/simple']]},
 {code:'INV-002',slug:'returns-damage-loss',category:'inventory',title:'Process returns, damage or loss',trigger:'Goods returned, damaged or missing.',prerequisites:'Account, SKU, physical count and incident or return authorization.',warnings:'Account-stock adjustment does not prove central warehouse receipt; review financial impact separately.',done:'Approved adjustment supported by physical evidence and reviewed settlement impact.',steps:[
 ['Inspect goods','Count and record condition, SKU and reason.','','Return or incident report'],
 ['Review adjustment','Open account inventory adjustment workflow and record authorized quantity and explanation.','/accounts'],
 ['Reconcile stock','Check account stock and any warehouse receipt or financial impact.','/accounts']]},
 {code:'EVT-002',slug:'prepare-kora-experience',category:'events',title:'Prepare Kora Experience for an event',trigger:'Scheduled event with selected activations.',prerequisites:'Calendar event, confirmed activation requirements and assigned logistics owner.',warnings:'Verify actual checklist generation locally before publication. Packing checkmarks require physical verification.',done:'Event packing list checked, setup verified and equipment return documented.',steps:[
 ['Verify event','Open Calendar and confirm date, venue and organizer.','/calendar'],
 ['Select experiences','Use event experience screen to select reusable activations and generate checklist, if verified.','/experiences'],
 ['Pack equipment','Assign owners, count items and mark physically packed items in event checklist.','/calendar'],
 ['Return and reconcile','Count returned equipment and report damage, loss and expenses.','/warehouse/equipment']]}
];

export class AcademyStarterDrafts1795770001000 implements MigrationInterface {
 name='AcademyStarterDrafts1795770001000';
 async up(q:QueryRunner):Promise<void>{
  await requireAcademyMigrationTarget(q);
  // Never overwrite an existing procedure. Seed drafts only, never publish.
  for(const s of starters){
   const [category]=await q.query('SELECT id FROM academy_categories WHERE code=$1',[s.category]);
   if(!category)throw new Error('Missing Academy category '+s.category);
   const [p]=await q.query('INSERT INTO academy_processes(code,slug,category_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[s.code,s.slug,category.id]);
   if(!p)continue;
   const [v]=await q.query(`INSERT INTO academy_process_versions(process_id,version,title,summary,trigger,prerequisites,warnings,success_criteria,allowed_roles,created_by)
     VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,0) RETURNING id`,[p.id,s.title,s.trigger,s.trigger,s.prerequisites,s.warnings,s.done,s.finance?['admin']:['admin','employee']]);
   for(const [i,step] of s.steps.entries())await q.query('INSERT INTO academy_steps(version_id,position,title,instructions,app_route,evidence) VALUES($1,$2,$3,$4,$5,$6)',[v.id,i+1,step[0],step[1],step[2]||null,step[3]||'']);
  }
 }
 async down():Promise<void>{
  throw new Error('Starter drafts may have been edited or published; rollback requires reviewed backup restore');
 }
}
