import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AccountingApiService, Phase2MFinding, Phase2MReadiness,
} from '../../core/services/accounting-api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-phase2m-readiness',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './phase2m-readiness.component.html',
})
export class Phase2MReadinessComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly auth = inject(AuthService);
  readonly allowed = computed(() => {
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1') &&
      this.auth.currentUser()?.role === 'admin';
  });
  readonly audit = signal<Phase2MReadiness | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly filter = signal<'all' | 'blocker' | 'warning'>('all');
  readonly filtered = computed<Phase2MFinding[]>(() =>
    (this.audit()?.findings || []).filter(f =>
      (this.filter() === 'all' || f.severity === this.filter()) &&
      [f.code, f.subjectType, f.subjectId, f.detail, f.proposedAction]
        .some(v => String(v ?? '').toLowerCase().includes(this.search().trim().toLowerCase()))));
  ngOnInit() {
    if (this.allowed()) this.refresh();
  }
  refresh() {
    if (!this.allowed() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.getPhase2MReadiness().subscribe({
      next: value => { this.audit.set(value); this.busy.set(false); },
      error: err => {
        this.busy.set(false); this.audit.set(null);
        const text = err?.error?.message;
        this.error.set(typeof text === 'string' ? text :
          'Phase 2M audit unavailable. Confirm the local kora_test backend, admin login and ACCOUNTING_PHASE2M_AUDIT=true.');
      },
    });
  }
  exportAudit() {
    const report = this.audit();
    if (!report) return;
    // Export is a *read-only snapshot* for external review, not approval.
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'phase2m-readiness-diagnostic.json';
    link.click();
    URL.revokeObjectURL(url);
  }
}
