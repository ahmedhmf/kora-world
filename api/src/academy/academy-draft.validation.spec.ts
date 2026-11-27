import { parseDraft, parseIdentity } from './academy-draft.validation';

const draft = { title:'Order balls', successCriteria:'PO saved', steps:[{title:'Verify supplier',instructions:'Check supplier',appRoute:'/suppliers'},{title:'Create PO',instructions:'Save draft',appRoute:'/purchase-orders/new'}] };
describe('Academy draft validation', () => {
  it('normalizes identity and step ordering', () => {
    expect(parseIdentity({code:'PUR-002',slug:'order-balls',categoryId:1})).toEqual({code:'PUR-002',slug:'order-balls',categoryId:1});
    expect(parseDraft(draft).steps.map(s=>s.position)).toEqual([1,2]);
  });
  it('rejects malformed identities', () => {
    expect(() => parseIdentity({code:'PUR-002',slug:'../other',categoryId:1})).toThrow();
    expect(() => parseIdentity({code:'PUR-002',slug:'order-balls',categoryId:'1'})).toThrow();
  });
  it('rejects unsafe routes, external roles and video URLs', () => {
    expect(() => parseDraft({...draft,allowedRoles:['supplier']})).toThrow();
    expect(() => parseDraft({...draft,videoUrl:'https://example.com'})).toThrow();
    expect(() => parseDraft({...draft,steps:[{title:'Step',instructions:'Text',appRoute:'//example.com'}]})).toThrow();
  });
  it('rejects invalid or empty step instructions', () => {
    expect(() => parseDraft({...draft,steps:[{title:'Step',instructions:' '}]})).toThrow();
    expect(() => parseDraft({...draft,steps:null})).toThrow();
  });
});
