import { AcademyAdminController } from './academy-admin.controller';
import { academyReleaseMigrations } from './academy-release.policy';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import type { DataSource } from 'typeorm';

const request = (role: string) => ({user:{role,sub:1}} as AuthenticatedRequest);
describe('Academy admin authorization', () => {
  it('rejects employees and suppliers before touching the database', async () => {
    const query = jest.fn();
    const controller = new AcademyAdminController({query} as unknown as DataSource);
    await expect(controller.list(request('employee'))).rejects.toThrow('Academy access denied');
    await expect(controller.list(request('supplier'))).rejects.toThrow('Academy access denied');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects production authoring before release migrations are installed', async () => {
    const query = jest.fn().mockResolvedValueOnce([{name:'kora_world'}]).mockResolvedValueOnce([{count:0}]);
    const transaction = jest.fn();
    const controller = new AcademyAdminController({query,transaction} as unknown as DataSource);
    await expect(controller.create(request('admin'),{})).rejects.toThrow('Academy release schema is not installed');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('allows production admin listing after all release migrations are installed', async () => {
    const query = jest.fn().mockResolvedValueOnce([{name:'kora_world'}])
      .mockResolvedValueOnce([{count:academyReleaseMigrations.length}]).mockResolvedValue([]);
    const controller = new AcademyAdminController({query} as unknown as DataSource);
    await expect(controller.list(request('admin'))).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('rejects unsupported databases before authoring', async () => {
    const query = jest.fn().mockResolvedValue([{name:'other_db'}]);
    const transaction = jest.fn();
    const controller = new AcademyAdminController({query,transaction} as unknown as DataSource);
    await expect(controller.create(request('admin'),{})).rejects.toThrow('Unsupported database');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects publishing a stale or already-published version', async () => {
    const tx = {query:jest.fn().mockResolvedValueOnce([{id:1}]).mockResolvedValueOnce([{id:3,version:2,published_at:null}])};
    const db = {query:jest.fn().mockResolvedValue([{name:'kora_test'}]),transaction:jest.fn(async (fn: (value: typeof tx)=>unknown)=>fn(tx))};
    const controller = new AcademyAdminController(db as unknown as DataSource);
    await expect(controller.publish(request('admin'),1,2)).rejects.toThrow('Only the current unpublished draft');
    expect(tx.query).toHaveBeenCalledTimes(2);
  });
});
