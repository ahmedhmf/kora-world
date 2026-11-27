import { MigrationInterface, QueryRunner } from 'typeorm';
import { requireAcademyMigrationTarget } from '../academy/academy-release.policy';

export class FounderEvidence1795770005000 implements MigrationInterface {
 name='FounderEvidence1795770005000';
 async up(q:QueryRunner):Promise<void>{
  await requireAcademyMigrationTarget(q);
  await q.query(`CREATE TABLE founder_evidence (
    id SERIAL PRIMARY KEY, transaction_id INTEGER NOT NULL REFERENCES founder_transactions(id) ON DELETE RESTRICT,
    filename VARCHAR(200) NOT NULL, mime_type VARCHAR(80) NOT NULL,
    content BYTEA NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 10485760),
    sha256 CHAR(64) NOT NULL, uploaded_by INTEGER NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(transaction_id,sha256))`);
 }
 async down():Promise<void>{throw new Error('Founder payment evidence requires reviewed backup restore');}
}
