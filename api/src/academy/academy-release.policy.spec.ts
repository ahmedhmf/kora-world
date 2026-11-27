import { requireAcademyMigrationTarget, requireAcademyRelease, academyReleaseMigrations } from './academy-release.policy';
import type { DataSource, QueryRunner } from 'typeorm';

describe('Academy production release safety',()=>{
 const flags=['KORA_ACADEMY_EXPLICIT_MIGRATION','KORA_ACADEMY_ENABLED','KORA_FOUNDER_ACCOUNTS_ENABLED'];
 const previous:Record<string,string|undefined>={};
 beforeEach(()=>{for(const f of flags){previous[f]=process.env[f];delete process.env[f];}});
 afterEach(()=>{for(const f of flags){if(previous[f]===undefined)delete process.env[f];else process.env[f]=previous[f];}});
 const runner=(name:string)=>({query:jest.fn().mockResolvedValue([{name}])}) as unknown as QueryRunner;
 const db=(name:string,count:number=academyReleaseMigrations.length)=>({query:jest.fn().mockResolvedValueOnce([{name}]).mockResolvedValueOnce([{count}])}) as unknown as DataSource;
 it('never admits production migrations implicitly',async()=>{
  await expect(requireAcademyMigrationTarget(runner('kora_world'))).rejects.toThrow();
  process.env.KORA_ACADEMY_EXPLICIT_MIGRATION='approved';
  await expect(requireAcademyMigrationTarget(runner('kora_world'))).resolves.toBeUndefined();
  await expect(requireAcademyMigrationTarget(runner('other_db'))).rejects.toThrow();
 });
 it('keeps local behavior',async()=>{
  await expect(requireAcademyMigrationTarget(runner('kora_test'))).resolves.toBeUndefined();
  await expect(requireAcademyRelease(db('kora_test'),'academy')).resolves.toBeUndefined();
 });
 it('requires the feature-specific flag and full migration history',async()=>{
  await expect(requireAcademyRelease(db('kora_world'),'academy')).rejects.toThrow();
  process.env.KORA_ACADEMY_ENABLED='true';
  await expect(requireAcademyRelease(db('kora_world',0),'academy')).rejects.toThrow();
  await expect(requireAcademyRelease(db('kora_world'),'academy')).resolves.toBeUndefined();
  await expect(requireAcademyRelease(db('kora_world'),'founders')).rejects.toThrow();
  process.env.KORA_FOUNDER_ACCOUNTS_ENABLED='true';
  await expect(requireAcademyRelease(db('kora_world'),'founders')).resolves.toBeUndefined();
 });
});
