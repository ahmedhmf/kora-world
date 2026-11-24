import { ConflictException } from '@nestjs/common';
import { InvoiceType } from '../invoices/entities/invoice.entity';
import { blockLegacySupplierPilotWrite, isLocalSupplierPilotMode } from './legacy-supplier-pilot.policy';

describe('Local EGP supplier legacy transition guard', () => {
  const previous = {
    flag: process.env.SUPPLIER_EGP_PILOT,
    name: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
  };
  afterAll(() => {
    if (previous.flag === undefined) delete process.env.SUPPLIER_EGP_PILOT;
    else process.env.SUPPLIER_EGP_PILOT = previous.flag;
    if (previous.name === undefined) delete process.env.DATABASE_NAME;
    else process.env.DATABASE_NAME = previous.name;
    if (previous.host === undefined) delete process.env.DATABASE_HOST;
    else process.env.DATABASE_HOST = previous.host;
  });
  beforeEach(() => {
    process.env.SUPPLIER_EGP_PILOT = 'true';
    process.env.DATABASE_NAME = 'kora_test';
    process.env.DATABASE_HOST = '127.0.0.1';
  });

  const incoming = { type: InvoiceType.INCOMING, currency: 'EGP' };

  it('blocks legacy EGP supplier writes only in explicit local test-pilot mode', () => {
    expect(isLocalSupplierPilotMode()).toBe(true);
    expect(() => blockLegacySupplierPilotWrite(incoming, 'Legacy payment'))
      .toThrow(ConflictException);
  });

  it('matches the pilot service default local host when DATABASE_HOST is unset', () => {
    delete process.env.DATABASE_HOST;
    expect(isLocalSupplierPilotMode()).toBe(true);
    expect(() => blockLegacySupplierPilotWrite(incoming, 'Legacy payment'))
      .toThrow(ConflictException);
  });

  it('allows outgoing, foreign-currency, and unlinked legacy transactions', () => {
    expect(() => blockLegacySupplierPilotWrite({ type: InvoiceType.OUTGOING, currency: 'EGP' }, 'Legacy payment')).not.toThrow();
    expect(() => blockLegacySupplierPilotWrite({ type: InvoiceType.INCOMING, currency: 'EUR' }, 'Legacy payment')).not.toThrow();
    expect(() => blockLegacySupplierPilotWrite(null, 'Legacy payment')).not.toThrow();
  });

  it.each([
    ['flag disabled', 'false', 'kora_test', '127.0.0.1'],
    ['wrong database', 'true', 'kora_world', '127.0.0.1'],
    ['remote host', 'true', 'kora_test', 'db.production.example'],
  ])('does not alter legacy operations when %s', (_title, flag, name, host) => {
    process.env.SUPPLIER_EGP_PILOT = flag;
    process.env.DATABASE_NAME = name;
    process.env.DATABASE_HOST = host;
    expect(isLocalSupplierPilotMode()).toBe(false);
    expect(() => blockLegacySupplierPilotWrite(incoming, 'Legacy payment')).not.toThrow();
  });
});
