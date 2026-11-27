import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Phase2MReadinessService } from './phase2m-readiness.service';

describe('Phase 2M snapshot isolation', () => {
  const old = {
    flag: process.env.ACCOUNTING_PHASE2M_AUDIT,
    name: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
  };
  const manager = {
    query: jest.fn(async () => [{ name: 'kora_test' }]),
    find: jest.fn(async () => []),
  };
  const db = {
    transaction: jest.fn(async (_isolation: string, fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
  };
  const service = new Phase2MReadinessService(db as unknown as DataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCOUNTING_PHASE2M_AUDIT = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
    manager.query.mockResolvedValue([{ name: 'kora_test' }]);
    manager.find.mockResolvedValue([]);
  });
  afterAll(() => {
    for (const [name, value] of Object.entries({
      ACCOUNTING_PHASE2M_AUDIT: old.flag,
      DATABASE_NAME: old.name, DATABASE_HOST: old.host,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('requires explicit read-only audit opt-in', async () => {
    process.env.ACCOUNTING_PHASE2M_AUDIT = 'false';
    await expect(service.audit()).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rejects production identity in configured environment', async () => {
    process.env.DATABASE_NAME = 'kora_world';
    await expect(service.audit()).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rejects a mismatched actual PostgreSQL identity', async () => {
    manager.query.mockResolvedValue([{ name: 'kora_world' }]);
    await expect(service.audit()).rejects.toThrow(ForbiddenException);
    expect(manager.find).not.toHaveBeenCalled();
  });
  it('uses one repeatable-read read-only snapshot', async () => {
    const result = await service.audit();
    expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
    expect(manager.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(manager.query).toHaveBeenCalledWith('SELECT current_database() AS name');
    expect(manager.find).toHaveBeenCalledTimes(4);
    expect(result.readyForProduction).toBe(false);
  });
});
