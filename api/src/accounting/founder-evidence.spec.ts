import { validateFounderEvidence } from './founder-evidence';

describe('Founder evidence validation',()=>{
 const file=(name:string,mime:string,buffer:Buffer)=>({originalname:name,mimetype:mime,buffer,size:buffer.length});
 it('accepts PDF and calculates a stable digest',()=>{
  const value=file('receipt.pdf','application/pdf',Buffer.from('%PDF-1.7'));
  expect(validateFounderEvidence(value).mime).toBe('application/pdf');
  expect(validateFounderEvidence(value).hash).toMatch(/^[0-9a-f]{64}$/);
 });
 it('accepts supported image signatures',()=>{
  expect(validateFounderEvidence(file('photo.jpg','image/jpeg',Buffer.from([255,216,255,0]))).mime).toBe('image/jpeg');
  expect(validateFounderEvidence(file('photo.png','image/png',Buffer.from([137,80,78,71,13,10,26,10]))).mime).toBe('image/png');
 });
 it('rejects disguised, empty and oversized files',()=>{
  expect(()=>validateFounderEvidence(file('fake.pdf','application/pdf',Buffer.from('<html>')))).toThrow();
  expect(()=>validateFounderEvidence(file('empty.pdf','application/pdf',Buffer.alloc(0)))).toThrow();
  expect(()=>validateFounderEvidence(file('big.pdf','application/pdf',Buffer.alloc(10485761)))).toThrow();
 });
 it('removes directory components',()=>{
  expect(validateFounderEvidence(file('../receipt.pdf','application/pdf',Buffer.from('%PDF-1.7'))).filename).toBe('receipt.pdf');
 });
});
