import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { AccountingApiService, Phase2JReport } from '../../core/services/accounting-api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  readonly store = inject(AccountingStore);
  private readonly api = inject(AccountingApiService);
  private readonly auth = inject(AuthService);
  readonly phase2jVisible = computed(() => {
    const host = window.location.hostname;
    const role = this.auth.currentUser()?.role;
    return (host === 'localhost' || host === '127.0.0.1') &&
      (role === 'admin' || role === 'accountant');
  });
  readonly phase2jReport = signal<Phase2JReport | null>(null);
  readonly phase2jLoading = signal(false);
  readonly phase2jError = signal<string | null>(null);
  private phase2jRequestId = 0;

  activeTab = signal<string>('pl');
  startDate = '2026-01-01';
  endDate = '2026-12-31';
  currency = 'EGP';
  asOfDate = '2026-12-31';

  readonly tabs = [
    { id: '2j', label: 'Verified EGP Preview (Local)' },
    { id: 'pl', label: 'Legacy Profit & Loss' },
    { id: 'bs', label: 'Legacy Balance Sheet' },
    { id: 'cf', label: 'Legacy Cash Flow' },
  ];

  ngOnInit() {
    // defaults
    const year = new Date().getFullYear();
    this.startDate = `${year}-01-01`;
    this.endDate = `${year}-12-31`;
    this.asOfDate = `${year}-12-31`;
    // Auto-load the active report so data is visible immediately
    this.runReport();
  }

  runReport() {
    const tab = this.activeTab();
    if (tab === 'pl') {
      this.store.loadProfitAndLoss({
        startDate: this.startDate,
        endDate: this.endDate,
        currency: this.currency
      });
    } else if (tab === 'bs') {
      this.store.loadBalanceSheet({
        asOfDate: this.asOfDate
      });
    } else if (tab === '2j') {
      this.loadPhase2J();
    } else if (tab === 'cf') {
      this.store.loadCashFlow({
        startDate: this.startDate,
        endDate: this.endDate
      });
    }
  }
  private loadPhase2J() {
    if (!this.phase2jVisible() || this.phase2jLoading()) return;
    const id = ++this.phase2jRequestId;
    this.phase2jLoading.set(true);
    this.phase2jError.set(null);
    this.phase2jReport.set(null);
    this.api.getPhase2JReport(this.startDate, this.endDate, this.asOfDate).subscribe({
      next: report => {
        if (id !== this.phase2jRequestId) return;
        this.phase2jLoading.set(false);
        this.phase2jReport.set(report);
      },
      error: () => {
        if (id !== this.phase2jRequestId) return;
        this.phase2jLoading.set(false);
        this.phase2jError.set(
          'Controlled Phase 2J reporting is unavailable. Verify the local kora_test backend and ACCOUNTING_PHASE2J_REPORT flag. No legacy totals were substituted.',
        );
      },
    });
  }
}
