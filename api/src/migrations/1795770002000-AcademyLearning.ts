import { MigrationInterface, QueryRunner } from 'typeorm';
import { requireAcademyMigrationTarget } from '../academy/academy-release.policy';

export class AcademyLearning1795770002000 implements MigrationInterface {
 name='AcademyLearning1795770002000';
 async up(q:QueryRunner):Promise<void>{
  await requireAcademyMigrationTarget(q);
  await q.query("ALTER TABLE academy_process_versions ADD COLUMN transcript TEXT NOT NULL DEFAULT ''");
  await q.query(`CREATE TABLE academy_training_assignments (
   id SERIAL PRIMARY KEY,user_id INTEGER NOT NULL,version_id INTEGER NOT NULL REFERENCES academy_process_versions(id),
   assigned_by INTEGER NOT NULL,assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),due_at DATE,
   UNIQUE(user_id,version_id))`);
  await q.query(`CREATE TABLE academy_training_progress (
   user_id INTEGER NOT NULL,version_id INTEGER NOT NULL REFERENCES academy_process_versions(id),
   step_ids INTEGER[] NOT NULL DEFAULT '{}',updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   PRIMARY KEY(user_id,version_id))`);
  await q.query(`CREATE TABLE academy_feedback (
   id SERIAL PRIMARY KEY,user_id INTEGER NOT NULL,version_id INTEGER NOT NULL REFERENCES academy_process_versions(id),
   message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),resolved_at TIMESTAMPTZ,resolved_by INTEGER)`);
  await q.query(`CREATE TABLE academy_checklist_runs (
   id SERIAL PRIMARY KEY,actor_id INTEGER NOT NULL,version_id INTEGER NOT NULL REFERENCES academy_process_versions(id),
   task_label VARCHAR(180) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),completed_at TIMESTAMPTZ)`);
  await q.query(`CREATE TABLE academy_step_results (
   run_id INTEGER NOT NULL REFERENCES academy_checklist_runs(id),step_id INTEGER NOT NULL REFERENCES academy_steps(id),
   checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),checked_by INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '',
   PRIMARY KEY(run_id,step_id))`);
 }
 async down():Promise<void>{throw new Error('Academy learning records require reviewed backup restore');}
}
