import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const localPilotMigrations = new Set([
  '1795770000000-AcademyFoundation',
  '1795770001000-AcademyStarterDrafts',
  '1795770002000-AcademyLearning',
  '1795770003000-FounderAccounts',
  '1795770004000-FounderAcademyDrafts',
  '1795770005000-FounderEvidence',
  '1795770006000-FounderEvidenceTraining',
]);

/** Do not register local-only migrations outside kora_test.
 *  A no-op migration would incorrectly mark its schema as applied.
 *  The migrations' own actual-database guards remain in place.
 */
export function selectMigrationFiles(files: string[], database: string | undefined): string[] {
  return files.filter(file => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
    .filter(file => database === 'kora_test' || !localPilotMigrations.has(file.replace(/\.(ts|js)$/, '')))
    .sort();
}

export function koraMigrationPaths(directory: string, database: string | undefined): string[] {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => entry.name);
  return selectMigrationFiles(files, database).map(file => join(directory, file).split(sep).join('/'));
}
