import { requireAcademyRelease } from '../academy/academy-release.policy';
import { Body, Controller, Get, Post, Req, UseGuards, Param, ParseIntPipe, UploadedFile, UseInterceptors, StreamableFile, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { validateFounderEvidence } from './founder-evidence';
import type { EvidenceUpload } from './founder-evidence';
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
  await requireAcademyRelease(this.db,'founders');
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
    AND a.code NOT IN ('2000','2100','2200','1103')
    AND NOT EXISTS(SELECT 1 FROM founder_accounts f WHERE f.account_id=a.id) ORDER BY a.code`);
  const attachments=await this.db.query('SELECT id,transaction_id,filename,mime_type,octet_length(content) AS size,uploaded_at FROM founder_evidence ORDER BY id');
  return {founders,transactions,accounts,attachments};
 }
 @Post()
 async register(@Req() req:AuthenticatedRequest,@Body() body:unknown){
  const actor=await this.actor(req),b=obj(body),name=str(b.name,120),accountId=id(b.accountId);
  return this.db.transaction(async tx=>{
   const a=await this.leaf(tx,accountId);
   if(a.type!=='liability'||['2000','2100','2200'].includes(a.code))throw new BadRequestException('Choose a dedicated founder liability account, not a general, supplier or tax account');
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
   if(kind==='expense' ? oa.type!=='expense' : oa.type!=='asset'||!oa.code.startsWith('11')||oa.code==='1103')throw new BadRequestException('Use an expense account or an eligible company cash/bank account');
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

 @Post('transactions/:id/evidence')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:0,parts:2}}))
 async uploadEvidence(@Req() req:AuthenticatedRequest,@Param('id',ParseIntPipe) transactionId:number,@UploadedFile() file:EvidenceUpload){
  const actor=await this.actor(req);
  const evidence=validateFounderEvidence(file);
  return this.db.transaction(async tx=>{
   const [transaction]=await tx.query('SELECT id FROM founder_transactions WHERE id=$1 FOR UPDATE',[transactionId]);
   if(!transaction)throw new NotFoundException('Founder transaction not found');
   const [count]=await tx.query('SELECT COUNT(*)::int AS total FROM founder_evidence WHERE transaction_id=$1',[transactionId]);
   if(count.total>=10)throw new BadRequestException('Maximum 10 attachments per transaction');
   const [row]=await tx.query(`INSERT INTO founder_evidence(transaction_id,filename,mime_type,content,sha256,uploaded_by)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(transaction_id,sha256) DO NOTHING RETURNING id,filename`,[transactionId,evidence.filename,evidence.mime,evidence.content,evidence.hash,actor]);
   if(!row)throw new ConflictException('This document is already attached');
   return row;
  });
 }
 @Get('transactions/:id/evidence/:fileId')
 async downloadEvidence(@Req() req:AuthenticatedRequest,@Param('id',ParseIntPipe) transactionId:number,@Param('fileId',ParseIntPipe) fileId:number){
  await this.actor(req);
  const [file]=await this.db.query('SELECT filename,content FROM founder_evidence WHERE id=$1 AND transaction_id=$2',[fileId,transactionId]);
  if(!file)throw new NotFoundException('Attachment not found');
  return new StreamableFile(file.content,{type:'application/octet-stream',disposition:"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),length:file.content.length});
 }
}
