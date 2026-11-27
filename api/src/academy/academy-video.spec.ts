import { validateAcademyVideo } from './academy-draft.validation';
describe('Academy approved video links',()=>{
 it('accepts exact configured HTTPS hosts',()=>{
  expect(validateAcademyVideo('https://training.example.org/watch/1','training.example.org')).toBe('https://training.example.org/watch/1');
 });
 it('rejects unapproved and deceptive hosts',()=>{
  for(const url of ['https://training.example.org.evil.test/x','https://training.example.org@evil.test/x','http://training.example.org/x','javascript:alert(1)','https://training.example.org:8443/x']){
   expect(()=>validateAcademyVideo(url,'training.example.org')).toThrow();
  }
 });
 it('allows an empty placeholder but denies unconfigured providers',()=>{
  expect(validateAcademyVideo('', '')).toBeNull();
  expect(()=>validateAcademyVideo('https://training.example.org/x','')).toThrow();
 });
});
