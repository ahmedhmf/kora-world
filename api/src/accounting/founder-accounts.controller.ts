import { Body, Controller, Get, Post, Req, UseGuards, BadRequestException, ForbiddenException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JournalWorkflowService } from './journal-workflow.service';

function obj(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new BadRequestException('Invalid request');
 return v as Record<string,unknown>;
}
function str(v:unknown,max:number):string{
 if(typeof v!=='string'||!v.trim()||v.length>max)throw new BadRequestException('Missing or invalid text');
 return v.trim();
}
function id(v:unknown):number{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<=0)throw new BadRequestException('Invalid account or amount');
 return v;
}
export function founderLines(kind:unknown,founder:number,other:number,amount:number){
 if(founder===other||!Number.isSafeInteger(amount)||amount<=0||amount>999999999999)throw new BadRequestException('Invalid journal amount or accounts');
 if(kind!=='expense'&&kind!=='loan'&&kind!=='repayment')throw new BadRequestException('Invalid founder transaction type');
 const debit=kind==='repayment'?founder:other,credit=kind==='repayment'?other:founder;
 return [{accountId:debit,debitCents:amount,creditCents:0},{accountId:credit,debitCents:0,creditCents:amount}];
}
@Controller('accounting/founders')
@UseGuards(AuthGuard)
export class FounderAccountsController{
 constructor(private readonly db:DataSource,private readonly workflow:JournalWorkflowService){}
 private async actor(req:AuthenticatedRequest){
  const [db]=await this.db.query('SELECT current_database() AS name');
  if(db?.name!=='kora_test')throw new ServiceUnavailableException('Founder pilot requires kora_test');
  const [u]=await this.db.query("SELECT id FROM users WHERE id=$1 AND role IN ('admin','accountant')",[req.user.sub]);
  if(!u)throw new ForbiddenException('Finance access required');
  return u.id as number;
 }
 private async leaf(tx:EntityManager,accountId:number){
  const [a]=await tx.query(`SELECT * FROM accounting_accounts a WHERE a.id=$1 AND a.is_active AND upper(a.currency)='EGP'
   AND NOT EXISTS(SELECT 1 FROM accounting_accounts c WHERE c.parent_id=a.id)`,[accountId]);
  if(!a)throw new BadRequestException('Choose an active EGP leaf account');
  return a;
 }
 @Get()
 async list(@Req() req:AuthenticatedRequest){
  await this.actor(req);
  const founders=await this.db.query(`SELECT f.account_id,f.founder_name,a.code,
    COALESCE(SUM(CASE WHEN j.posting_status IN ('posted','reversed') AND l.currency='EGP' THEN (l.credit-l.debit)*100 ELSE 0 END),0)::text AS balance_cents
    FROM founder_accounts f JOIN accounting_accounts a ON a.id=f.account_id
    LEFT JOIN journal_lines l ON l.account_id=a.id LEFT JOIN journal_entries j ON j.id=l.journal_entry_id
    GROUP BY f.account_id,f.founder_name,a.code ORDER BY f.founder_name`);
  const transactions=await this.db.query(`SELECT t.id,t.account_id,t.kind,t.evidence_reference,j.id AS journal_id,j.date,j.description,j.posting_status,
    (SELECT ABS(l.credit-l.debit)*100 FROM journal_lines l WHERE l.journal_entry_id=j.id AND l.account_id=t.account_id LIMIT 1)::text AS amount_cents
    FROM founder_transactions t JOIN journal_entries j ON j.id=t.journal_id ORDER BY t.id DESC`);
  const accounts=await this.db.query(`SELECT a.id,a.code,a.name,a.type FROM accounting_accounts a WHERE a.is_active AND upper(a.currency)='EGP'
    AND NOT EXISTS(SELECT 1 FROM accounting_accounts c WHERE c.parent_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM founder_accounts f WHERE f.account_id=a.id) ORDER BY a.code`);
  return {founders,transactions,accounts};
 }
 @Post()
 async register(@Req() req:AuthenticatedRequest,@Body() body:unknown){
  const actor=await this.actor(req),b=obj(body),name=str(b.name,120),accountId=id(b.accountId);
  return this.db.transaction(async tx=>{
   const a=await this.leaf(tx,accountId);
   if(a.type!=='liability')throw new BadRequestException('Founder account must be a liability');
   const [row]=await tx.query('INSERT INTO founder_accounts(account_id,founder_name,created_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING account_id',[accountId,name,actor]);
   if(!row)throw new ConflictException('Founder name or liability account already registered');
   return row;
  });
 }
 @Post('transactions')
 async create(@Req() req:AuthenticatedRequest,@Body() body:unknown){
  const actor=await this.actor(req),b=obj(body),founder=id(b.accountId),other=id(b.otherAccountId),amount=id(b.amountCents);
  const kind=b.kind,date=str(b.date,10),description=str(b.description,500),evidence=str(b.evidenceReference,300),key=str(b.requestKey,100);
  const lines=founderLines(kind,founder,other,amount);
  return this.db.transaction(async tx=>{
   // Serializes requests through this feature, including duplicate submission checks.
   const [f]=await tx.query('SELECT * FROM founder_accounts WHERE account_id=$1 FOR UPDATE',[founder]);
   if(!f)throw new BadRequestException('Select a registered founder');
   const [duplicate]=await tx.query('SELECT journal_id FROM founder_transactions WHERE request_key=$1',[key]);
   if(duplicate)throw new ConflictException('Request already recorded; refresh history');
   const [sameEvidence]=await tx.query('SELECT id FROM founder_transactions WHERE account_id=$1 AND kind=$2 AND lower(evidence_reference)=lower($3)',[founder,kind,evidence]);
   if(sameEvidence)throw new ConflictException('Evidence reference already used for this founder and transaction type');
   const fa=await this.leaf(tx,founder),oa=await this.leaf(tx,other);
   if(fa.type!=='liability')throw new BadRequestException('Founder liability account is no longer valid');
   if(kind==='expense' ? oa.type!=='expense' : oa.type!=='asset'||!oa.code.startsWith('11'))throw new BadRequestException('Use an expense account or an eligible company cash/bank account');
   if(kind==='repayment'){
    const [balance]=await tx.query(`SELECT COALESCE(SUM(CASE WHEN j.posting_status IN ('posted','reversed') THEN (l.credit-l.debit)*100
      WHEN j.posting_status IN ('draft','pending_approval') AND l.debit>0 THEN -l.debit*100 ELSE 0 END),0)::text AS available
      FROM journal_lines l JOIN journal_entries j ON j.id=l.journal_entry_id WHERE l.account_id=$1 AND l.currency='EGP'`,[founder]);
    if(Number(balance.available)<amount)throw new BadRequestException('Repayment exceeds posted liability less pending repayments');
   }
   const journal=await this.workflow.createDraft({date,description:'Founder '+String(kind)+': '+description,reference:key,lines},actor,tx);
   await tx.query('INSERT INTO founder_transactions(account_id,journal_id,kind,evidence_reference,request_key,created_by) VALUES($1,$2,$3,$4,$5,$6)',[founder,journal.id,kind,evidence,key,actor]);
   return {journalId:journal.id,status:'draft'};
  });
 }
}
