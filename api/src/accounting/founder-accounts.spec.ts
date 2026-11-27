import { founderLines } from './founder-accounts.controller';

describe('Founder journal mapping',()=>{
 it('records personal expenses without touching company cash',()=>{
  expect(founderLines('expense',1,2,500000)).toEqual([
   {accountId:2,debitCents:500000,creditCents:0},
   {accountId:1,debitCents:0,creditCents:500000}]);
 });
 it('credits liability for repayable funding',()=>{
  expect(founderLines('loan',1,3,5000000)).toEqual([
   {accountId:3,debitCents:5000000,creditCents:0},
   {accountId:1,debitCents:0,creditCents:5000000}]);
 });
 it('reduces liability and cash for reimbursement',()=>{
  expect(founderLines('repayment',1,3,300000)).toEqual([
   {accountId:1,debitCents:300000,creditCents:0},
   {accountId:3,debitCents:0,creditCents:300000}]);
 });
 it('rejects invalid inputs',()=>{
  expect(()=>founderLines('capital',1,2,100)).toThrow();
  expect(()=>founderLines('expense',1,1,100)).toThrow();
  expect(()=>founderLines('loan',1,2,0)).toThrow();
  expect(()=>founderLines('loan',1,2,1.5)).toThrow();
 });
});
