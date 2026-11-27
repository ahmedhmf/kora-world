import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcademyFoundation1795770000000 implements MigrationInterface {
  name = 'AcademyFoundation1795770000000';

  private async requireTestDb(q: QueryRunner): Promise<void> {
    const [db] = await q.query('SELECT current_database() AS name');
    if (db?.name !== 'kora_test') {
      throw new Error('Academy pilot migration requires kora_test; production rollout is not approved');
    }
  }

  async up(q: QueryRunner): Promise<void> {
    await this.requireTestDb(q);
    await q.query(`CREATE TABLE academy_categories (
      id SERIAL PRIMARY KEY, code VARCHAR(40) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await q.query(`CREATE TABLE academy_processes (
      id SERIAL PRIMARY KEY, code VARCHAR(40) UNIQUE NOT NULL,
      slug VARCHAR(120) UNIQUE NOT NULL,
      category_id INTEGER NOT NULL REFERENCES academy_categories(id),
      archived_at TIMESTAMPTZ
    )`);
    await q.query(`CREATE TABLE academy_process_versions (
      id SERIAL PRIMARY KEY, process_id INTEGER NOT NULL REFERENCES academy_processes(id),
      version INTEGER NOT NULL CHECK (version > 0),
      title VARCHAR(180) NOT NULL, summary TEXT NOT NULL DEFAULT '',
      trigger TEXT NOT NULL DEFAULT '', prerequisites TEXT NOT NULL DEFAULT '',
      warnings TEXT NOT NULL DEFAULT '', success_criteria TEXT NOT NULL DEFAULT '',
      video_url TEXT, allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','employee']::TEXT[],
      created_by INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_by INTEGER, published_at TIMESTAMPTZ,
      UNIQUE(process_id, version)
    )`);
    await q.query(`CREATE TABLE academy_steps (
      id SERIAL PRIMARY KEY, version_id INTEGER NOT NULL REFERENCES academy_process_versions(id),
      position INTEGER NOT NULL CHECK (position > 0),
      title VARCHAR(180) NOT NULL, instructions TEXT NOT NULL,
      app_route VARCHAR(200), evidence TEXT NOT NULL DEFAULT '',
      UNIQUE(version_id, position)
    )`);
    await q.query(`CREATE TABLE academy_training_completions (
      user_id INTEGER NOT NULL, version_id INTEGER NOT NULL REFERENCES academy_process_versions(id),
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id, version_id)
    )`);
    await q.query(`INSERT INTO academy_categories(code,name,sort_order) VALUES
      ('purchasing','Purchasing',10), ('products','Suppliers & Products',20),
      ('warehouse','Warehousing & Delivery',30), ('sales','B2B Sales',40),
      ('inventory','Inventory',50), ('finance','Finance',60),
      ('events','Events / Kora Experiences',70), ('system','System Administration',80)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await this.requireTestDb(q);
    for (const table of ['academy_training_completions','academy_steps','academy_process_versions','academy_processes','academy_categories']) {
      await q.query('DROP TABLE ' + table);
    }
  }
}
