import { ConflictException } from '@nestjs/common';
import { InvoiceType } from '../invoices/entities/invoice.entity';

/**
 * Phase 2I transition safety guard. It does NOT migrate legacy accounting.
 * Only activates when the isolated local supplier pilot is explicitly enabled.
 * Production legacy behavior is unchanged until a separately reviewed rollout.
 */
export function isLocalSupplierPilotMode(): boolean {
  return process.env.SUPPLIER_EGP_PILOT === 'true' &&
    process.env.DATABASE_NAME === 'kora_test' &&
    ['localhost', '127.0.0.1', '::1'].includes(process.env.DATABASE_HOST || '');
}

export function blockLegacySupplierPilotWrite(
  invoice: { type?: InvoiceType | string; currency?: string } | null | undefined,
  operation: string,
): void {
  if (isLocalSupplierPilotMode() &&
      invoice?.type === InvoiceType.INCOMING &&
      invoice.currency?.toUpperCase() === 'EGP') {
    throw new ConflictException(
      `Local supplier EGP pilot: ${operation} must use the controlled supplier workflow; legacy posting is disabled`,
    );
  }
}
