import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Phase2JReportService } from './phase2j-report.service';

describe('Phase2JReportService local read-only gate', () => {
  const old = {
    flag: process.env.ACCOUNTING_PHASE2J_REPORT,
    name: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
  };
  const manager = {
    query: jest.fn(async () => [{ database_name: 'kora_test' }]),
    find: jest.fn(async () => []),
  };
  const db = {
    transaction: jest.fn(async (_level: string, cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
  };
  const service = new Phase2JReportService(db as unknown as DataSource);
  const run = () => service.get('2026-01-01', '2026-12-31', '2026-12-31');
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCOUNTING_PHASE2J_REPORT = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
    manager.query.mockResolvedValue([{ database_name: 'kora_test' }]);
    manager.find.mockResolvedValue([]);
  });
  afterAll(() => {
    for (const [key, value] of Object.entries({
      ACCOUNTING_PHASE2J_REPORT: old.flag,
      DATABASE_NAME: old.name, DATABASE_HOST: old.host,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('refuses without the explicit feature flag', async () => {
    delete process.env.ACCOUNTING_PHASE2J_REPORT;
    await expect(run()).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('refuses configured production database even with the flag', async () => {
    process.env.DATABASE_NAME = 'kora_world';
    await expect(run()).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('refuses a connected database that is not kora_test', async () => {
    manager.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ database_name: 'kora_world' }]);
    await expect(run()).rejects.toThrow(ForbiddenException);
    expect(manager.find).not.toHaveBeenCalled();
  });
  it('rejects invalid or inconsistent reporting dates', async () => {
    await expect(service.get('2026-02-30', '2026-12-31', '2026-12-31'))
      .rejects.toThrow(BadRequestException);
    await expect(service.get('2026-12-31', '2026-01-01', '2026-12-31'))
      .rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('reads a single repeatable read snapshot without writes', async () => {
    const r = await run();
    expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
    expect(manager.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(manager.query).toHaveBeenCalledWith('SELECT current_database() AS database_name');
    expect(manager.find).toHaveBeenCalledTimes(4);
    expect(r.ap.invoices).toEqual([]);
    expect(r.ar.invoices).toEqual([]);
    expect(r.cashFlow).toEqual([]);
  });
});
