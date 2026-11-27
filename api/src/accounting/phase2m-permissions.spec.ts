import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import { Phase2MReadinessController } from './phase2m-readiness.controller';
import { Phase2LBankController } from './phase2l-bank.controller';
import { Phase2JReportController } from './phase2j-report.controller';
import { InvoicePaymentReconciliationController } from './invoice-payment-reconciliation.controller';
import { ControlledSupplierInvoiceBookingController } from '../invoices/controlled-supplier-invoice-booking.controller';

/** Contract tests: permission metadata; backend guards still require integration checks. */
describe('Accounting production-readiness authorization contract', () => {
  const allowed = (controller: object, method: string) => Reflect.getMetadata(
    ROLES_KEY, (controller as Record<string, unknown>)[method] as object,
  ) as string[] | undefined;

  it('limits historical audit to admins', () => {
    expect(allowed(Phase2MReadinessController.prototype, 'audit')).toEqual(['admin']);
    expect(allowed(InvoicePaymentReconciliationController.prototype, 'audit')).toEqual(['admin']);
  });
  it('limits opening balances, imports and match/unmatch to admins', () => {
    const p = Phase2LBankController.prototype;
    for (const name of ['opening', 'import', 'match', 'unmatch']) {
      expect(allowed(p, name)).toEqual(['admin']);
    }
  });
  it('permits accountant read-only history and Phase 2J report only', () => {
    expect(allowed(Phase2LBankController.prototype, 'list')).toEqual(['admin', 'accountant']);
    expect(allowed(Phase2JReportController.prototype, 'get')).toEqual(['admin', 'accountant']);
  });
  it('limits controlled supplier invoice booking to admin', () => {
    expect(allowed(ControlledSupplierInvoiceBookingController.prototype, 'book'))
      .toEqual(['admin']);
  });
});
