import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingApiService, Phase2JReport } from '../../core/services/accounting-api.service';
import { AuthService } from '../../core/services/auth.service';

/** Only the controlled EGP diagnostic remains; legacy statement views are retired. */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
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

  startDate = '';
  endDate = '';
  asOfDate = '';

  ngOnInit(): void {
    const year = new Date().getFullYear();
    this.startDate = `${year}-01-01`;
    this.endDate = `${year}-12-31`;
    this.asOfDate = `${year}-12-31`;
    this.runReport();
  }

  runReport(): void {
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
          'Controlled EGP reporting is unavailable. Verify local kora_test and ACCOUNTING_PHASE2J_REPORT. No legacy totals were substituted.',
        );
      },
    });
  }
}
