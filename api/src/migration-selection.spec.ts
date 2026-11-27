import { selectMigrationFiles } from './migration-selection';

describe('Kora migration isolation', () => {
  const pilots = [
    '1795770000000-AcademyFoundation',
    '1795770001000-AcademyStarterDrafts',
    '1795770002000-AcademyLearning',
    '1795770003000-FounderAccounts',
    '1795770004000-FounderAcademyDrafts',
    '1795770005000-FounderEvidence',
    '1795770006000-FounderEvidenceTraining',
  ];
  for (const extension of ['ts', 'js']) {
    const ordinary = '1764300000000-Phase2LBankReconciliation.' + extension;
    const files = [ordinary, ...pilots.map(p => p + '.' + extension), 'notes.txt', 'ignored.d.ts'];
    it('excludes all seven pilot migrations in production (' + extension + ')', () => {
      expect(selectMigrationFiles(files, 'kora_world')).toEqual([ordinary]);
      expect(selectMigrationFiles(files, undefined)).toEqual([ordinary]);
    });
    it('preserves the full migration sequence in kora_test (' + extension + ')', () => {
      expect(selectMigrationFiles(files, 'kora_test')).toEqual([ordinary, ...pilots.map(p => p + '.' + extension)]);
    });
  }
});
