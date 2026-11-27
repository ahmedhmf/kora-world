import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource, QueryRunner } from 'typeorm';

export const academyReleaseMigrations = [
 'AcademyFoundation1795770000000','AcademyStarterDrafts1795770001000','AcademyLearning1795770002000',
 'FounderAccounts1795770003000','FounderAcademyDrafts1795770004000','FounderEvidence1795770005000','FounderEvidenceTraining1795770006000',
] as const;

export async function requireAcademyMigrationTarget(q:QueryRunner):Promise<void>{
 const [db]=await q.query('SELECT current_database() AS name');
 if(db?.name==='kora_test')return;
 if(db?.name==='kora_world' && process.env.KORA_ACADEMY_EXPLICIT_MIGRATION==='approved')return;
 throw new Error('Academy release requires kora_test or explicit approved kora_world migration');
}
export async function requireAcademyRelease(db:DataSource,_feature:'academy'|'founders'):Promise<void>{
 const [identity]=await db.query('SELECT current_database() AS name');
 if(identity?.name==='kora_test')return;
 if(identity?.name!=='kora_world')throw new ServiceUnavailableException('Unsupported database');
 const [history]=await db.query('SELECT COUNT(DISTINCT name)::int AS count FROM migrations WHERE name=ANY($1::text[])',[[...academyReleaseMigrations]]);
 if(history?.count!==academyReleaseMigrations.length)throw new ServiceUnavailableException('Academy release schema is not installed');
}
