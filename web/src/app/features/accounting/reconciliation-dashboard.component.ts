import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  AccountingApiService, InvoiceAuditRow, Phase2JReport, ReconciliationAudit,
} from '../../core/services/accounting-api.service';

interface DashboardIssue {
  key: string;
  source: 'Audit' | 'Phase 2J';
  code: string;
  detail: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  journalId: number | null;
  category: 'Invoices' | 'Payments' | 'Journals' | 'Currency / Other';
}

@Component({
  selector: 'app-reconciliation-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reconciliation-dashboard.component.html',
})
export class ReconciliationDashboardComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  readonly auth = inject(AuthService);
  readonly allowed = computed(() => {
    const hostname = window.location.hostname;
    return (hostname === 'localhost' || hostname === '127.0.0.1') &&
      this.auth.currentUser()?.role === 'admin';
  });

  startDate = `${new Date().getFullYear()}-01-01`;
  endDate = `${new Date().getFullYear()}-12-31`;
  asOfDate = `${new Date().getFullYear()}-12-31`;
  search = '';
  category = 'All';
  showOnlyIssues = true;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly audit = signal<ReconciliationAudit | null>(null);
  readonly report = signal<Phase2JReport | null>(null);
  readonly loadedAt = signal<string | null>(null);
  private runId = 0;

  readonly exceptionRows = computed<DashboardIssue[]>(() => {
    const audit = this.audit();
    const report = this.report();
    if (!audit || !report) return [];
    const result: DashboardIssue[] = [];
    for (const inv of audit.invoices) {
      for (const code of inv.issues) {
        result.push({
          key: `audit:${inv.invoiceId}:${code}`, source: 'Audit', code,
          detail: 'Structural invoice/payment audit requires review',
          invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber,
          journalId: null, category: this.groupFor(code),
        });
      }
    }
    for (const [index, issue] of report.issues.entries()) {
      const inv = audit.invoices.find(row => row.invoiceId === issue.invoiceId);
      result.push({
        key: `2j:${index}`, source: 'Phase 2J', code: issue.code,
        detail: issue.detail, invoiceId: issue.invoiceId ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        journalId: issue.journalId ?? null, category: this.groupFor(issue.code),
      });
    }
    for (const id of audit.unassignedPayments) {
      result.push({ key: `unassigned-payment:${id}`, source: 'Audit',
        code: 'payment_without_invoice_link', detail: `Payment #${id} has no valid invoice link; standalone payments may be intentional`,
        invoiceId: null, invoiceNumber: null, journalId: null, category: 'Payments' });
    }
    for (const id of audit.unassignedJournals) {
      result.push({ key: `unassigned-journal:${id}`, source: 'Audit',
        code: 'journal_without_invoice_link', detail: 'Payment-type journal is not linked to a valid invoice; standalone entries may be intentional',
        invoiceId: null, invoiceNumber: null, journalId: id, category: 'Journals' });
    }
    return result;
  });

  readonly visibleExceptions = computed(() => {
    const q = this.search.trim().toLowerCase();
    const group = this.category;
    return this.exceptionRows().filter(row =>
      (group === 'All' || row.category === group) &&
      (!q || [row.code, row.detail, row.invoiceNumber, row.invoiceId,
        row.journalId].some(v => String(v ?? '').toLowerCase().includes(q))));
  });
  readonly checkedInvoices = computed(() => this.audit()?.totalInvoices ?? 0);
  readonly flaggedInvoices = computed(() => this.audit()?.flaggedInvoices ?? 0);
  readonly verifiedBalances = computed(() => ({
    ap: this.report()?.ap.outstandingEgp ?? 0,
    ar: this.report()?.ar.outstandingEgp ?? 0,
    excluded: (this.report()?.ap.reviewCount ?? 0) + (this.report()?.ar.reviewCount ?? 0),
  }));

  ngOnInit() {
    if (this.allowed()) this.refresh();
  }

  refresh() {
    if (!this.allowed() || this.loading()) return;
    const id = ++this.runId;
    this.loading.set(true);
    this.error.set(null);
    // Two *independent* read-only transactions: timestamps are close, not a
    // guaranteed common DB snapshot. Never claim cross-report atomicity.
    forkJoin({
      audit: this.api.getReconciliationAudit(),
      report: this.api.getPhase2JReport(this.startDate, this.endDate, this.asOfDate),
    }).subscribe({
      next: ({ audit, report }) => {
        if (id !== this.runId) return;
        this.audit.set(audit);
        this.report.set(report);
        this.loadedAt.set(new Date().toISOString());
        this.loading.set(false);
      },
      error: (err: { status?: number; error?: { message?: string | string[] } }) => {
        if (id !== this.runId) return;
        this.loading.set(false);
        this.audit.set(null);
        this.report.set(null);
        const msg = err?.error?.message;
        const message = Array.isArray(msg) ? msg.join(', ') : msg;
        this.error.set(message ||
          (err?.status === 403
            ? 'Access denied: the audit and Phase 2J features must be enabled on local kora_test and you must be an admin.'
            : 'Could not load both read-only snapshots. Check the local backend and try again.'));
      },
    });
  }

  private groupFor(code: string): DashboardIssue['category'] {
    if (/currency|fx|balance_sheet|unassigned/.test(code)) return 'Currency / Other';
    if (/journal|booking|reversal|account/.test(code)) return 'Journals';
    if (/payment|paid|settlement/.test(code)) return 'Payments';
    return 'Invoices';
  }
}
